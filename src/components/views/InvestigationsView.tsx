import React, { useState } from 'react';
import { Investigation, EvidenceItem, CustodyTransfer, User } from '../../types/forensics';
import {
  Briefcase,
  Search,
  Plus,
  ArrowRight,
  Download,
  CheckCircle,
  AlertCircle,
  FileText,
  X
} from 'lucide-react';
import { generateInvestigationPdfReport } from '../../services/pdfGenerator';
import { api } from '../../services/api';

interface InvestigationsViewProps {
  cases: Investigation[];
  evidence: EvidenceItem[];
  transfers: CustodyTransfer[];
  currentUser: User;
  onOpenNewCaseModal: () => void;
  onSelectEvidence: (evidenceId: string) => void;
  onCaseUpdated: () => void;
}

export const InvestigationsView: React.FC<InvestigationsViewProps> = ({
  cases,
  evidence,
  transfers,
  currentUser,
  onOpenNewCaseModal,
  onCaseUpdated
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<Investigation | null>(null);
  const [isClosingCase, setIsClosingCase] = useState(false);
  const [closureSummary, setClosureSummary] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const filteredCases = cases.filter(c => {
    const matchesSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || c.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleExportPdf = (investigation: Investigation) => {
    const caseEvidence = evidence.filter(e => e.caseId === investigation.id);
    const caseTransfers = transfers.filter(t => t.caseId === investigation.id);
    generateInvestigationPdfReport(investigation, caseEvidence, caseTransfers, currentUser);
  };

  const handleCloseCase = async () => {
    if (!selectedCase) return;
    try {
      setIsUpdating(true);
      await api.updateCase(selectedCase.id, {
        status: 'Closed',
        closureSummary: closureSummary || 'Forensic investigation completed and evidence sealed.'
      });
      setIsClosingCase(false);
      setSelectedCase(null);
      onCaseUpdated();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const canManageCases = ['Administrator', 'Lead Investigator'].includes(currentUser.role);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DFE8F3] dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#142B4D] dark:text-slate-100 flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-[#155EEF]" />
            Investigation Dossiers
          </h1>
          <p className="text-sm text-[#60748F] dark:text-slate-400 mt-1">
            Authoritative incident response cases, electronic discovery files, and lead assignment.
          </p>
        </div>

        {canManageCases && (
          <button
            onClick={onOpenNewCaseModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#155EEF] hover:bg-[#124bbf] rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#60748F] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Case ID (CASE-2026-...), Title, Threat Actor, or Tag..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-200 placeholder-[#60748F] focus:outline-none focus:ring-2 focus:ring-[#155EEF]/20 focus:border-[#155EEF]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-300 focus:outline-none focus:border-[#155EEF] cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under Review">Under Review</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-300 focus:outline-none focus:border-[#155EEF] cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCases.map(item => {
          const caseEvidence = evidence.filter(e => e.caseId === item.id);
          const isClosed = item.status === 'Closed';

          const priorityBadge =
            item.priority === 'Critical' || item.priority === 'High'
              ? 'bg-red-50 text-[#DC2626] border-red-200'
              : item.priority === 'Medium'
              ? 'bg-amber-50 text-[#F59E0B] border-amber-200'
              : 'bg-emerald-50 text-[#12A66A] border-emerald-200';

          const statusBadge = isClosed
            ? 'bg-slate-100 text-[#60748F] border-slate-200'
            : item.status === 'Under Review'
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-[#EAF2FF] text-[#155EEF] border-[#DFE8F3]';

          return (
            <div
              key={item.id}
              onClick={() => setSelectedCase(item)}
              className="p-5 rounded-xl border border-[#DFE8F3] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-[#155EEF]/50 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#155EEF]">{item.id}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityBadge}`}>
                      {item.priority}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[#142B4D] dark:text-slate-100 group-hover:text-[#155EEF] transition-colors line-clamp-2">
                  {item.title}
                </h3>

                <p className="text-xs text-[#60748F] dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] font-mono text-[#60748F] dark:text-slate-400 bg-[#F5F8FC] dark:bg-slate-950 px-1.5 py-0.5 rounded border border-[#DFE8F3] dark:border-slate-800">
                        #{tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-[10px] font-mono text-[#60748F]">+{item.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-[#DFE8F3] dark:border-slate-800/80 flex items-center justify-between text-xs text-[#60748F] dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#60748F]" />
                  <span>{caseEvidence.length} Evidence Artifacts</span>
                </div>
                <div className="flex items-center gap-1 text-[#155EEF] font-semibold group-hover:translate-x-0.5 transition-transform">
                  <span>Dossier</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCases.length === 0 && (
        <div className="p-12 text-center border border-dashed border-[#DFE8F3] dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50">
          <Briefcase className="w-8 h-8 text-[#60748F] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#142B4D] dark:text-slate-300">No matching investigation cases found</p>
          <p className="text-xs text-[#60748F] dark:text-slate-500 mt-1">Adjust search parameters or open a new investigation.</p>
        </div>
      )}

      {/* Case Details Drawer / Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-[#DFE8F3] dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#155EEF]">{selectedCase.id}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#F5F8FC] text-[#60748F] border-[#DFE8F3]">
                    {selectedCase.category}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#EAF2FF] text-[#155EEF] border-[#DFE8F3]">
                    {selectedCase.status}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#142B4D] dark:text-white mt-1">{selectedCase.title}</h2>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-[#60748F] hover:text-[#142B4D] dark:hover:text-white p-1 rounded-lg hover:bg-[#F5F8FC] dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <div>
                <h4 className="font-semibold text-[#142B4D] dark:text-slate-300 mb-1.5">Executive Description</h4>
                <p className="text-[#60748F] dark:text-slate-400 leading-relaxed bg-[#F5F8FC] dark:bg-slate-950 p-3.5 rounded-xl border border-[#DFE8F3] dark:border-slate-800">
                  {selectedCase.description}
                </p>
              </div>

              {/* Case Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F5F8FC] dark:bg-slate-950 p-4 rounded-xl border border-[#DFE8F3] dark:border-slate-800">
                <div>
                  <span className="text-[#60748F] block">Priority</span>
                  <span className="font-semibold text-[#142B4D] dark:text-slate-200">{selectedCase.priority}</span>
                </div>
                <div>
                  <span className="text-[#60748F] block">Retention Window</span>
                  <span className="font-semibold text-[#142B4D] dark:text-slate-200">{selectedCase.retentionYears} Years</span>
                </div>
                <div>
                  <span className="text-[#60748F] block">Opened (UTC)</span>
                  <span className="font-mono text-[#142B4D] dark:text-slate-200">
                    {new Date(selectedCase.createdAt).toISOString().slice(0, 10)}
                  </span>
                </div>
                <div>
                  <span className="text-[#60748F] block">Lead Investigator</span>
                  <span className="font-semibold text-[#155EEF]">#DFIR-LEAD</span>
                </div>
              </div>

              {/* Evidence Artifacts in this Case */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#142B4D] dark:text-slate-200">
                    Attached Evidence Artifacts ({evidence.filter(e => e.caseId === selectedCase.id).length})
                  </h4>
                </div>

                <div className="space-y-2">
                  {evidence
                    .filter(e => e.caseId === selectedCase.id)
                    .map(ev => (
                      <div
                        key={ev.id}
                        className="p-3 bg-[#F5F8FC] dark:bg-slate-950 border border-[#DFE8F3] dark:border-slate-800 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#155EEF]">{ev.id}</span>
                            <span className="text-[#142B4D] dark:text-slate-300 font-medium truncate">{ev.originalFileName}</span>
                          </div>
                          <div className="text-[11px] text-[#60748F] truncate font-mono mt-0.5">
                            SHA-256: {ev.sha256Baseline}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-[#DFE8F3] dark:border-slate-800 text-[#60748F] dark:text-slate-300 font-medium">
                            {ev.custodyState}
                          </span>
                        </div>
                      </div>
                    ))}

                  {evidence.filter(e => e.caseId === selectedCase.id).length === 0 && (
                    <div className="p-4 text-center text-[#60748F] border border-dashed border-[#DFE8F3] dark:border-slate-800 rounded-xl">
                      No evidence artifacts currently attached to this case.
                    </div>
                  )}
                </div>
              </div>

              {/* Closure Details if Closed */}
              {selectedCase.status === 'Closed' && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 space-y-1">
                  <span className="font-semibold text-[#12A66A] flex items-center gap-1.5 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-[#12A66A]" />
                    Case Closure Summary
                  </span>
                  <p className="text-[#142B4D] dark:text-slate-400 text-xs mt-1">
                    {selectedCase.closureSummary || 'Investigation finalized.'}
                  </p>
                  <div className="text-[11px] text-[#60748F] pt-1">
                    Closed At: {selectedCase.closedAt ? new Date(selectedCase.closedAt).toUTCString() : 'Recorded'}
                  </div>
                </div>
              )}

              {/* Case Closure Input Section */}
              {isClosingCase && selectedCase.status !== 'Closed' && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-slate-950 border border-amber-300 dark:border-amber-800/80 space-y-3">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Formal Case Closure & Evidence Retention Seal
                  </h4>
                  <textarea
                    rows={3}
                    value={closureSummary}
                    onChange={e => setClosureSummary(e.target.value)}
                    placeholder="Enter judicial resolution, forensic findings, or prosecution closure summary..."
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-slate-800 rounded-lg text-[#142B4D] dark:text-slate-200 text-xs focus:outline-none focus:border-[#155EEF]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsClosingCase(false)}
                      className="px-3 py-1.5 text-xs text-[#60748F] hover:text-[#142B4D] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCloseCase}
                      disabled={isUpdating}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-[#DC2626] hover:bg-red-700 text-white rounded-lg cursor-pointer"
                    >
                      {isUpdating ? 'Sealing...' : 'Confirm Closure'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-[#DFE8F3] dark:border-slate-800 flex items-center justify-between bg-[#F5F8FC] dark:bg-slate-950/60">
              <button
                onClick={() => handleExportPdf(selectedCase)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#142B4D] dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-[#EAF2FF] rounded-lg border border-[#DFE8F3] dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#155EEF]" />
                <span>Download Forensic PDF Report</span>
              </button>

              <div className="flex items-center gap-2">
                {canManageCases && selectedCase.status !== 'Closed' && !isClosingCase && (
                  <button
                    onClick={() => setIsClosingCase(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 rounded-lg border border-amber-300 dark:border-amber-800 transition-colors cursor-pointer"
                  >
                    Close Investigation
                  </button>
                )}
                <button
                  onClick={() => setSelectedCase(null)}
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
