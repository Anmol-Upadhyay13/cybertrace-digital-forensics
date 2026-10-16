import React, { useState } from 'react';
import { EvidenceItem, User } from '../../types/forensics';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Play,
  RotateCcw,
  Download,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { api } from '../../services/api';
import { generateEvidenceIntegrityPdf } from '../../services/pdfGenerator';

interface IntegrityVerificationViewProps {
  evidence: EvidenceItem[];
  currentUser: User;
  onRefresh: () => void;
}

export const IntegrityVerificationView: React.FC<IntegrityVerificationViewProps> = ({
  evidence,
  currentUser,
  onRefresh
}) => {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [adversarialId, setAdversarialId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleVerifySingle = async (evidenceId: string) => {
    try {
      setVerifyingId(evidenceId);
      const res = await api.verifyEvidenceIntegrity(evidenceId);
      setActionFeedback(`Verification ${res.result} for ${evidenceId}. Observed: ${res.observedHash.slice(0, 16)}...`);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerifyAll = async () => {
    try {
      setIsVerifyingAll(true);
      for (const item of evidence) {
        await api.verifyEvidenceIntegrity(item.id);
      }
      setActionFeedback(`Completed batch SHA-256 recalculation across all ${evidence.length} evidence artifacts.`);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const handleSimulateTamper = async (evidenceId: string) => {
    if (!window.confirm(`Simulate bit-stream tampering on ${evidenceId} to test cryptographic integrity detection?`)) {
      return;
    }
    try {
      setAdversarialId(evidenceId);
      const res = await api.simulateTamper(evidenceId);
      await api.verifyEvidenceIntegrity(evidenceId);
      setActionFeedback(res.message);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdversarialId(null);
    }
  };

  const handleRestoreTamper = async (evidenceId: string) => {
    try {
      setAdversarialId(evidenceId);
      const res = await api.restoreTamper(evidenceId);
      await api.verifyEvidenceIntegrity(evidenceId);
      setActionFeedback(res.message);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdversarialId(null);
    }
  };

  const handleExportCert = async (item: EvidenceItem) => {
    try {
      const full = await api.getEvidenceItem(item.id);
      generateEvidenceIntegrityPdf(item, full.verifications || [], currentUser);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  const mismatches = evidence.filter(e => e.lastVerificationResult === 'MISMATCH');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DFE8F3] dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#142B4D] dark:text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#155EEF]" />
            Evidence Integrity & Cryptographic Parity
          </h1>
          <p className="text-sm text-[#60748F] dark:text-slate-400 mt-1">
            Independent server-side FIPS 180-4 SHA-256 re-hashing against authoritative intake baselines.
          </p>
        </div>

        <button
          onClick={handleVerifyAll}
          disabled={isVerifyingAll || evidence.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isVerifyingAll ? 'animate-spin' : ''}`} />
          <span>{isVerifyingAll ? 'Verifying Entire Vault...' : 'Verify All Evidence'}</span>
        </button>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="p-4 rounded-xl bg-[#EAF2FF] dark:bg-cyan-950/70 border border-[#DFE8F3] dark:border-cyan-800 text-[#155EEF] dark:text-cyan-200 text-xs flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#155EEF] dark:text-cyan-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs text-[#60748F] hover:text-[#142B4D] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Critical Mismatch Warning */}
      {mismatches.length > 0 && (
        <div className="p-5 rounded-xl border border-red-200 dark:border-rose-800 bg-red-50 dark:bg-rose-950/40 text-red-950 dark:text-rose-200 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-[#DC2626]">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] animate-pulse" />
            <span>ALERT: {mismatches.length} EVIDENCE ARTIFACT(S) CORRUPTED / TAMPERED</span>
          </div>
          <p className="text-xs text-red-900 dark:text-rose-300 leading-relaxed">
            The stored electronic binary does not produce the registered baseline hash. The chain of integrity has been severed for these items. Isolate immediately for root-cause forensic investigation.
          </p>
          <div className="space-y-1.5 pt-1">
            {mismatches.map(m => (
              <div key={m.id} className="p-3 bg-white dark:bg-slate-950/80 rounded-lg border border-red-200 dark:border-rose-900/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-[#DC2626]">{m.id}</span>
                  <span className="text-[#142B4D] dark:text-slate-300 ml-2 font-medium">{m.originalFileName}</span>
                </div>
                <button
                  onClick={() => handleRestoreTamper(m.id)}
                  className="px-3 py-1 text-[11px] font-semibold bg-[#12A66A] hover:bg-emerald-600 text-white rounded cursor-pointer"
                >
                  Restore Pristine Bit-Stream
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adversarial Testing Explanation Box */}
      <div className="p-5 rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900/90 text-xs space-y-2 shadow-xs">
        <div className="flex items-center gap-2 text-[#155EEF] font-semibold">
          <Cpu className="w-4 h-4" />
          <span>Adversarial Verification Protocol (Test Harness)</span>
        </div>
        <p className="text-[#60748F] dark:text-slate-400 leading-relaxed">
          In a court of law or judicial hearing, forensic integrity relies on proving that even a single flipped bit will be immediately detected. Use the <strong className="text-[#DC2626]">"Simulate Tamper"</strong> button to introduce a single-block perturbation into the private server storage. CyberTrace will recalculate the live SHA-256 hash and immediately flag a cryptographic mismatch. Use <strong className="text-[#12A66A]">"Restore"</strong> to revert to the authenticated baseline.
        </p>
      </div>

      {/* Evidence Verification Table */}
      <div className="rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#DFE8F3] dark:border-slate-800 bg-[#F5F8FC] dark:bg-slate-950/60 text-[#60748F] dark:text-slate-400 font-semibold">
                <th className="py-3 px-4 font-semibold">Artifact ID</th>
                <th className="py-3 px-4 font-semibold">Artifact Name</th>
                <th className="py-3 px-4 font-mono font-semibold">Baseline Hash (SHA-256)</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Last Verified (UTC)</th>
                <th className="py-3 px-4 text-right font-semibold">Integrity Engine Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE8F3] dark:divide-slate-800/60 font-mono">
              {evidence.map(item => {
                const isMismatch = item.lastVerificationResult === 'MISMATCH';
                const isChecking = verifyingId === item.id || isVerifyingAll;
                const isTesting = adversarialId === item.id;

                return (
                  <tr key={item.id} className="hover:bg-[#F5F8FC] dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#155EEF]">
                      {item.id}
                    </td>

                    <td className="py-3.5 px-4 font-sans text-[#142B4D] dark:text-slate-200 font-medium">
                      {item.originalFileName}
                    </td>

                    <td className="py-3.5 px-4 text-[11px] text-[#60748F] dark:text-slate-400" title={item.sha256Baseline}>
                      {item.sha256Baseline.slice(0, 16)}...{item.sha256Baseline.slice(-8)}
                    </td>

                    <td className="py-3.5 px-4 font-sans">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isMismatch
                            ? 'bg-red-50 text-[#DC2626] border-red-200 animate-pulse'
                            : 'bg-emerald-50 text-[#12A66A] border-emerald-200'
                        }`}
                      >
                        {item.lastVerificationResult || 'VERIFIED'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-[#60748F] text-[11px]">
                      {item.lastVerifiedAt
                        ? new Date(item.lastVerifiedAt).toISOString().slice(0, 16).replace('T', ' ')
                        : 'At Intake'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        {/* Verify Live */}
                        <button
                          onClick={() => handleVerifySingle(item.id)}
                          disabled={isChecking}
                          className="px-2.5 py-1 text-xs font-semibold text-[#142B4D] dark:text-slate-200 bg-[#F5F8FC] dark:bg-slate-800 hover:bg-[#EAF2FF] rounded-lg border border-[#DFE8F3] dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Play className={`w-3 h-3 ${isChecking ? 'animate-spin text-[#155EEF]' : ''}`} />
                          <span>Re-Hash</span>
                        </button>

                        {/* Adversarial Tamper / Restore */}
                        {isMismatch ? (
                          <button
                            onClick={() => handleRestoreTamper(item.id)}
                            disabled={isTesting}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-[#12A66A] hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore Bit-Stream</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSimulateTamper(item.id)}
                            disabled={isTesting}
                            className="px-2.5 py-1 text-xs font-semibold text-[#DC2626] bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Simulate Tamper</span>
                          </button>
                        )}

                        {/* Export Integrity PDF */}
                        <button
                          onClick={() => handleExportCert(item)}
                          title="Generate Integrity Certificate"
                          className="p-1 text-[#60748F] hover:text-[#142B4D] rounded-lg hover:bg-[#F5F8FC] cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
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
    </div>
  );
};
