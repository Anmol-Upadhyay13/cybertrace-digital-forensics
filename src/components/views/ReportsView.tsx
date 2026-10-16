import React, { useState } from 'react';
import { Investigation, EvidenceItem, CustodyTransfer, User } from '../../types/forensics';
import {
  Download,
  FileText,
  FileCheck,
  Table,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { generateInvestigationPdfReport, generateEvidenceIntegrityPdf } from '../../services/pdfGenerator';
import { api } from '../../services/api';

interface ReportsViewProps {
  cases: Investigation[];
  evidence: EvidenceItem[];
  transfers: CustodyTransfer[];
  currentUser: User;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  cases,
  evidence,
  transfers,
  currentUser
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>(evidence[0]?.id || '');

  const handleGenerateCasePdf = () => {
    const targetCase = cases.find(c => c.id === selectedCaseId);
    if (!targetCase) return;
    const caseEvidence = evidence.filter(e => e.caseId === targetCase.id);
    const caseTransfers = transfers.filter(t => t.caseId === targetCase.id);
    generateInvestigationPdfReport(targetCase, caseEvidence, caseTransfers, currentUser);
  };

  const handleGenerateIntegrityPdf = async () => {
    const targetEvidence = evidence.find(e => e.id === selectedEvidenceId);
    if (!targetEvidence) return;
    try {
      const full = await api.getEvidenceItem(targetEvidence.id);
      generateEvidenceIntegrityPdf(targetEvidence, full.verifications || [], currentUser);
    } catch (err: any) {
      alert('Failed to generate integrity certificate: ' + err.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-[#DFE8F3] dark:border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-[#142B4D] dark:text-slate-100 flex items-center gap-2.5">
          <Download className="w-6 h-6 text-[#155EEF]" />
          Forensic Reports & Judicial Exports
        </h1>
        <p className="text-sm text-[#60748F] dark:text-slate-400 mt-1">
          Cryptographically signed evidence summaries, chain of custody logs, and audit ledger exports.
        </p>
      </div>

      {/* Legal & Regulatory Notice */}
      <div className="p-5 rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-[#EAF2FF] dark:bg-slate-900/90 flex items-start gap-3.5 text-xs text-[#142B4D] dark:text-slate-400 leading-relaxed shadow-xs">
        <AlertCircle className="w-5 h-5 text-[#155EEF] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[#142B4D] dark:text-slate-200 block mb-0.5">
            Judicial Admissibility & Forensic Evidentiary Standard Notice
          </span>
          Generated PDF and CSV exports contain cryptographic SHA-256 hashes verifying mathematical bit-stream consistency against authenticated intake baselines. Chain of custody reports record attributable handovers with digital recipient signature hashes. Legal admissibility remains subject to jurisdictional rules of electronic evidence and verification of physical security controls.
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Report 1: Investigation Summary PDF */}
        <div className="p-6 rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#EAF2FF] border border-[#DFE8F3] flex items-center justify-center text-[#155EEF]">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#142B4D] dark:text-white">Investigation Dossier (PDF)</h3>
            <p className="text-xs text-[#60748F] dark:text-slate-400 leading-relaxed">
              Complete judicial report containing case summary, list of all registered evidence artifacts with SHA-256 baselines, and chronological chain of custody transfer history.
            </p>

            <div className="pt-2">
              <label className="text-xs font-semibold text-[#142B4D] dark:text-slate-300 block mb-1.5">
                Select Case Dossier:
              </label>
              <select
                value={selectedCaseId}
                onChange={e => setSelectedCaseId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-200 focus:outline-none focus:border-[#155EEF] cursor-pointer"
              >
                {cases.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateCasePdf}
            disabled={!selectedCaseId}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Generate Case Summary PDF</span>
          </button>
        </div>

        {/* Report 2: Cryptographic Integrity Certificate PDF */}
        <div className="p-6 rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#12A66A]">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#142B4D] dark:text-white">Evidence Integrity Certificate (PDF)</h3>
            <p className="text-xs text-[#60748F] dark:text-slate-400 leading-relaxed">
              Formal certificate certifying mathematical parity of an individual digital artifact. Includes intake baseline, re-verification logs, and algorithm parameters.
            </p>

            <div className="pt-2">
              <label className="text-xs font-semibold text-[#142B4D] dark:text-slate-300 block mb-1.5">
                Select Evidence Artifact:
              </label>
              <select
                value={selectedEvidenceId}
                onChange={e => setSelectedEvidenceId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-200 focus:outline-none focus:border-[#155EEF] cursor-pointer"
              >
                {evidence.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.id} — {e.originalFileName} ({e.caseId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateIntegrityPdf}
            disabled={!selectedEvidenceId}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#12A66A] hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Generate Integrity Certificate PDF</span>
          </button>
        </div>

        {/* Report 3: Evidence Inventory CSV */}
        <div className="p-6 rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Table className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#142B4D] dark:text-white">Evidence Inventory Ledger (CSV)</h3>
            <p className="text-xs text-[#60748F] dark:text-slate-400 leading-relaxed">
              Complete tabular export of all electronic evidence items across all investigations, including device serial numbers, intake collectors, storage references, and SHA-256 baselines.
            </p>
          </div>

          <a
            href={api.getCsvExportUrl('evidence')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#142B4D] dark:text-slate-200 bg-[#F5F8FC] dark:bg-slate-800 hover:bg-[#EAF2FF] rounded-lg border border-[#DFE8F3] dark:border-slate-700 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#155EEF]" />
            <span>Download Evidence Inventory CSV</span>
          </a>
        </div>

        {/* Report 4: Chain of Custody Ledger CSV */}
        <div className="p-6 rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#F59E0B]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#142B4D] dark:text-white">Chain of Custody Ledger (CSV)</h3>
            <p className="text-xs text-[#60748F] dark:text-slate-400 leading-relaxed">
              Sequential ledger of all physical and logical custody handovers, sender notes, recipient sign-offs, and recipient digital signature hashes.
            </p>
          </div>

          <a
            href={api.getCsvExportUrl('custody')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#142B4D] dark:text-slate-200 bg-[#F5F8FC] dark:bg-slate-800 hover:bg-[#EAF2FF] rounded-lg border border-[#DFE8F3] dark:border-slate-700 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#F59E0B]" />
            <span>Download Custody Ledger CSV</span>
          </a>
        </div>
      </div>
    </div>
  );
};
