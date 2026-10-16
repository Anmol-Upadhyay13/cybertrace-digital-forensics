import React, { useState } from 'react';
import { EvidenceItem, User } from '../../types/forensics';
import {
  Database,
  Search,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Download,
  GitCommit,
  HardDrive,
  Cpu,
  FileCode,
  Smartphone,
  Server,
  X,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { generateEvidenceIntegrityPdf } from '../../services/pdfGenerator';

interface EvidenceVaultViewProps {
  evidence: EvidenceItem[];
  currentUser: User;
  onOpenIntakeModal: () => void;
  onInitiateTransfer: (evidenceId: string) => void;
  onRefresh: () => void;
}

export const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({
  evidence,
  currentUser,
  onOpenIntakeModal,
  onInitiateTransfer,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [custodyFilter, setCustodyFilter] = useState('all');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<{ id: string; result: 'MATCH' | 'MISMATCH'; hash: string } | null>(null);

  const filteredEvidence = evidence.filter(e => {
    const matchesSearch =
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.originalFileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.sha256Baseline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.sourceDevice.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesCustody = custodyFilter === 'all' || e.custodyState === custodyFilter;

    return matchesSearch && matchesCategory && matchesCustody;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Forensic Memory Dump':
        return Cpu;
      case 'Network Packet Capture':
        return Server;
      case 'External Storage / USB':
        return HardDrive;
      case 'Mobile Device':
        return Smartphone;
      default:
        return FileCode;
    }
  };

  const handleVerify = async (evidenceId: string) => {
    try {
      setVerifyingId(evidenceId);
      const res = await api.verifyEvidenceIntegrity(evidenceId);
      setVerificationFeedback({
        id: evidenceId,
        result: res.result,
        hash: res.observedHash
      });
      onRefresh();
    } catch (err: any) {
      alert('Verification error: ' + err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleExportCert = async (item: EvidenceItem) => {
    try {
      const full = await api.getEvidenceItem(item.id);
      generateEvidenceIntegrityPdf(item, full.verifications || [], currentUser);
    } catch (err: any) {
      alert('Could not export certificate: ' + err.message);
    }
  };

  const canIntake = ['Administrator', 'Lead Investigator', 'Investigator', 'Evidence Custodian'].includes(currentUser.role);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DFE8F3] dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#142B4D] dark:text-slate-100 flex items-center gap-2.5">
            <Database className="w-6 h-6 text-[#155EEF]" />
            Electronic Evidence Vault
          </h1>
          <p className="text-sm text-[#60748F] dark:text-slate-400 mt-1">
            Authoritative registry of forensically preserved bit-streams, physical disk captures, and SHA-256 baselines.
          </p>
        </div>

        {canIntake && (
          <button
            onClick={onOpenIntakeModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Intake Artifact</span>
          </button>
        )}
      </div>

      {/* Verification Flash Alert */}
      {verificationFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all shadow-xs ${
            verificationFeedback.result === 'MATCH'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 border-red-200 text-red-900 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {verificationFeedback.result === 'MATCH' ? (
              <CheckCircle2 className="w-5 h-5 text-[#12A66A] shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-[#DC2626] shrink-0" />
            )}
            <div className="text-xs">
              <span className="font-bold">
                {verificationFeedback.result === 'MATCH' ? 'CRYPTOGRAPHIC PARITY CONFIRMED:' : 'CRITICAL HASH MISMATCH:'}
              </span>{' '}
              {verificationFeedback.id} observed SHA-256 hash:{' '}
              <span className="font-mono">{verificationFeedback.hash}</span>
            </div>
          </div>
          <button
            onClick={() => setVerificationFeedback(null)}
            className="text-xs text-[#60748F] hover:text-[#142B4D] dark:hover:text-slate-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filter Row */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#60748F] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Evidence ID, Case, File Name, Device Serial, or SHA-256 Baseline..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-200 placeholder-[#60748F] focus:outline-none focus:ring-2 focus:ring-[#155EEF]/20 focus:border-[#155EEF]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-300 focus:outline-none focus:border-[#155EEF] cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="Forensic Memory Dump">Memory Dumps</option>
            <option value="Network Packet Capture">Network Captures</option>
            <option value="External Storage / USB">Storage & USB</option>
            <option value="System & Security Logs">Logs & Telemetry</option>
          </select>

          <select
            value={custodyFilter}
            onChange={e => setCustodyFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-300 focus:outline-none focus:border-[#155EEF] cursor-pointer"
          >
            <option value="all">All Custody States</option>
            <option value="In Vault">In Vault</option>
            <option value="Checked Out for Analysis">Checked Out</option>
            <option value="Transfer In Transit">In Transit</option>
          </select>
        </div>
      </div>

      {/* High-Density Evidence Table */}
      <div className="rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#DFE8F3] dark:border-slate-800 bg-[#F5F8FC] dark:bg-slate-950/60 text-[#60748F] dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Artifact ID</th>
                <th className="py-3 px-4">Case File</th>
                <th className="py-3 px-4">Artifact & Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 font-mono">SHA-256 Baseline</th>
                <th className="py-3 px-4">Custody Status</th>
                <th className="py-3 px-4">Custodian</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE8F3] dark:divide-slate-800/60">
              {filteredEvidence.map(item => {
                const Icon = getCategoryIcon(item.category);
                const isMismatch = item.lastVerificationResult === 'MISMATCH';

                const statusBadge =
                  item.custodyState === 'In Vault'
                    ? 'bg-slate-100 text-[#60748F] border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    : item.custodyState === 'Transfer In Transit'
                    ? 'bg-amber-50 text-[#F59E0B] border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-[#EAF2FF] text-[#155EEF] border-[#DFE8F3] dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800';

                return (
                  <tr key={item.id} className="hover:bg-[#F5F8FC] dark:hover:bg-slate-800/40 transition-colors">
                    {/* Artifact ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#155EEF] flex items-center gap-1.5">
                        <span>{item.id}</span>
                        {item.isSyntheticDemo && (
                          <span className="text-[9px] font-mono text-[#60748F] px-1 rounded bg-[#F5F8FC] border border-[#DFE8F3] dark:bg-slate-800 dark:border-slate-700" title="Synthetic Benchmark Demo Record">
                            DEMO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#60748F] dark:text-slate-500 font-mono mt-0.5">
                        {(item.fileSizeBytes / 1024).toFixed(1)} KB
                      </div>
                    </td>

                    {/* Case File */}
                    <td className="py-3.5 px-4 font-mono text-[#142B4D] dark:text-slate-300 font-medium">
                      {item.caseId}
                    </td>

                    {/* Artifact Name & Description */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div
                        onClick={() => setSelectedEvidence(item)}
                        className="text-[#142B4D] dark:text-white font-semibold hover:text-[#155EEF] cursor-pointer truncate"
                      >
                        {item.originalFileName}
                      </div>
                      <div className="text-[11px] text-[#60748F] dark:text-slate-400 truncate mt-0.5">
                        {item.description}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-[#60748F] dark:text-slate-300">
                        <Icon className="w-3.5 h-3.5 text-[#155EEF] shrink-0" />
                        <span className="truncate">{item.category}</span>
                      </div>
                    </td>

                    {/* SHA-256 Baseline Hash */}
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {isMismatch ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#12A66A] shrink-0" />
                        )}
                        <span className={isMismatch ? 'text-[#DC2626] font-bold' : 'text-[#60748F] dark:text-slate-300'} title={item.sha256Baseline}>
                          {item.sha256Baseline.slice(0, 10)}...{item.sha256Baseline.slice(-6)}
                        </span>
                      </div>
                    </td>

                    {/* Custody State */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge}`}>
                        {item.custodyState}
                      </span>
                    </td>

                    {/* Custodian */}
                    <td className="py-3.5 px-4 text-[#142B4D] dark:text-slate-300">
                      <div className="font-medium">{item.currentCustodianName}</div>
                      <div className="text-[10px] text-[#60748F] dark:text-slate-500 truncate">{item.currentLocation}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Live Verify Button */}
                        <button
                          onClick={() => handleVerify(item.id)}
                          disabled={verifyingId === item.id}
                          title="Run live SHA-256 integrity verification"
                          className="p-1.5 text-[#60748F] hover:text-[#155EEF] hover:bg-[#F5F8FC] dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                        >
                          <ShieldCheck className={`w-4 h-4 ${verifyingId === item.id ? 'animate-spin text-[#155EEF]' : ''}`} />
                        </button>

                        {/* Transfer Button */}
                        <button
                          onClick={() => onInitiateTransfer(item.id)}
                          disabled={item.isLockedForTransfer}
                          title={item.isLockedForTransfer ? 'Transfer currently pending' : 'Initiate Custody Transfer'}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            item.isLockedForTransfer
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-[#60748F] hover:text-[#F59E0B] hover:bg-[#F5F8FC] dark:hover:bg-slate-800'
                          }`}
                        >
                          <GitCommit className="w-4 h-4" />
                        </button>

                        {/* Download Evidence File */}
                        <a
                          href={api.getEvidenceDownloadUrl(item.id)}
                          title="Download protected bit-stream"
                          className="p-1.5 text-[#60748F] hover:text-[#142B4D] hover:bg-[#F5F8FC] dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer inline-flex items-center"
                        >
                          <Download className="w-4 h-4" />
                        </a>

                        {/* View Metadata Details */}
                        <button
                          onClick={() => setSelectedEvidence(item)}
                          title="View Acquisition Metadata"
                          className="p-1.5 text-[#60748F] hover:text-[#142B4D] hover:bg-[#F5F8FC] dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredEvidence.length === 0 && (
        <div className="p-12 text-center border border-dashed border-[#DFE8F3] dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50">
          <Database className="w-8 h-8 text-[#60748F] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#142B4D] dark:text-slate-300">No evidence artifacts found</p>
          <p className="text-xs text-[#60748F] dark:text-slate-500 mt-1">Check search keywords or intake a new artifact.</p>
        </div>
      )}

      {/* Evidence Full Acquisition Metadata Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[#DFE8F3] dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#155EEF]">{selectedEvidence.id}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#F5F8FC] text-[#60748F] border-[#DFE8F3]">
                    {selectedEvidence.category}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#EAF2FF] text-[#155EEF] border-[#DFE8F3]">
                    {selectedEvidence.custodyState}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#142B4D] dark:text-white mt-1">{selectedEvidence.originalFileName}</h2>
              </div>
              <button
                onClick={() => setSelectedEvidence(null)}
                className="text-[#60748F] hover:text-[#142B4D] dark:hover:text-white p-1 rounded-lg hover:bg-[#F5F8FC] dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Baseline Hash Callout */}
              <div className="p-4 rounded-xl bg-[#EAF2FF] dark:bg-slate-950 border border-[#DFE8F3] dark:border-cyan-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#155EEF] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Cryptographic SHA-256 Intake Baseline
                  </span>
                  <span className="text-[10px] font-mono text-[#60748F]">Node.js Crypto Engine</span>
                </div>
                <div className="font-mono text-xs text-[#142B4D] dark:text-slate-200 break-all bg-white dark:bg-slate-900 p-2.5 rounded border border-[#DFE8F3] dark:border-slate-800 select-all">
                  {selectedEvidence.sha256Baseline}
                </div>
                <div className="text-[11px] text-[#60748F] flex justify-between">
                  <span>Byte Length: {selectedEvidence.fileSizeBytes} bytes</span>
                  <span>Registered: {selectedEvidence.registeredAt}</span>
                </div>
              </div>

              {/* Acquisition Details */}
              <div className="space-y-2">
                <h4 className="font-semibold text-[#142B4D] dark:text-slate-300">Forensic Acquisition Metadata</h4>
                <div className="grid grid-cols-2 gap-3 bg-[#F5F8FC] dark:bg-slate-950 p-4 rounded-xl border border-[#DFE8F3] dark:border-slate-800">
                  <div>
                    <span className="text-[#60748F] block">Source Device</span>
                    <span className="font-semibold text-[#142B4D] dark:text-slate-200">{selectedEvidence.sourceDevice}</span>
                  </div>
                  <div>
                    <span className="text-[#60748F] block">Serial Number</span>
                    <span className="font-mono text-[#142B4D] dark:text-slate-200">{selectedEvidence.serialNumber || 'N/A (Logical)'}</span>
                  </div>
                  <div>
                    <span className="text-[#60748F] block">Collection Method</span>
                    <span className="font-semibold text-[#155EEF]">{selectedEvidence.collectionMethod}</span>
                  </div>
                  <div>
                    <span className="text-[#60748F] block">Collector</span>
                    <span className="font-semibold text-[#142B4D] dark:text-slate-200">
                      {selectedEvidence.collectorName} (Badge #{selectedEvidence.collectorBadge})
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#60748F] block">Collection Location</span>
                    <span className="text-[#142B4D] dark:text-slate-300">{selectedEvidence.collectionLocation}</span>
                  </div>
                </div>
              </div>

              {/* Acquisition Notes */}
              <div>
                <h4 className="font-semibold text-[#142B4D] dark:text-slate-300 mb-1">Acquisition & Intake Notes</h4>
                <p className="text-[#60748F] dark:text-slate-400 leading-relaxed bg-[#F5F8FC] dark:bg-slate-950 p-3.5 rounded-xl border border-[#DFE8F3] dark:border-slate-800">
                  {selectedEvidence.acquisitionNotes}
                </p>
              </div>

              {/* Custody Info */}
              <div className="grid grid-cols-2 gap-3 bg-[#F5F8FC] dark:bg-slate-950 p-4 rounded-xl border border-[#DFE8F3] dark:border-slate-800">
                <div>
                  <span className="text-[#60748F] block">Official Custodian</span>
                  <span className="font-semibold text-[#142B4D] dark:text-slate-200">{selectedEvidence.currentCustodianName}</span>
                </div>
                <div>
                  <span className="text-[#60748F] block">Physical Vault Location</span>
                  <span className="font-semibold text-[#142B4D] dark:text-slate-200">{selectedEvidence.currentLocation}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t border-[#DFE8F3] dark:border-slate-800 flex items-center justify-between bg-[#F5F8FC] dark:bg-slate-950/60">
              <button
                onClick={() => handleExportCert(selectedEvidence)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#142B4D] dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-[#EAF2FF] rounded-lg border border-[#DFE8F3] dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#155EEF]" />
                <span>Download Integrity Certificate PDF</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVerify(selectedEvidence.id)}
                  disabled={verifyingId === selectedEvidence.id}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg transition-colors cursor-pointer"
                >
                  Verify Integrity Now
                </button>
                <button
                  onClick={() => setSelectedEvidence(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#60748F] dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-lg border border-[#DFE8F3] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
