import React, { useState } from 'react';
import { EvidenceItem, User } from '../../types/forensics';
import { GitCommit, X, Lock, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';

interface TransferRequestModalProps {
  evidence: EvidenceItem[];
  users: User[];
  currentUser: User;
  preselectedEvidenceId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferRequestModal: React.FC<TransferRequestModalProps> = ({
  evidence,
  users,
  currentUser,
  preselectedEvidenceId,
  onClose,
  onSuccess
}) => {
  const availableEvidence = evidence.filter(e => !e.isLockedForTransfer);

  const [evidenceId, setEvidenceId] = useState(
    preselectedEvidenceId || availableEvidence[0]?.id || ''
  );
  const [toCustodianId, setToCustodianId] = useState(
    users.find(u => u.id !== currentUser.id)?.id || users[0]?.id || ''
  );
  const [transferMethod, setTransferMethod] = useState<any>('Direct Handover');
  const [destinationLocation, setDestinationLocation] = useState('Digital Forensics Lab Station #2');
  const [transferReason, setTransferReason] = useState('');
  const [senderNotes, setSenderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedItem = evidence.find(e => e.id === evidenceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceId) {
      setErrorMsg('Please select an available evidence artifact.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await api.requestCustodyTransfer({
        evidenceId,
        toCustodianId,
        transferReason,
        transferMethod,
        destinationLocation,
        senderNotes
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-cyan-400" />
            Initiate Chain of Custody Transfer
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200">
            {errorMsg}
          </div>
        )}

        <div className="p-3 rounded-lg bg-slate-950 border border-amber-900/60 text-amber-300 flex items-start gap-2">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Concurrency Lock:</strong> Upon submission, this evidence will be locked into "Transfer In Transit" state. Conflicting transfer requests are blocked by the state machine until acknowledged or rejected.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-slate-300 block mb-1 font-medium">Evidence Artifact</label>
            <select
              required
              value={evidenceId}
              onChange={e => setEvidenceId(e.target.value)}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer font-mono"
            >
              {availableEvidence.map(e => (
                <option key={e.id} value={e.id}>
                  {e.id} — {e.originalFileName} ({e.custodyState})
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
              Current Custodian: <span className="text-slate-200">{selectedItem.currentCustodianName}</span> · Location:{' '}
              <span className="text-slate-200">{selectedItem.currentLocation}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Intended Recipient Custodian</label>
              <select
                required
                value={toCustodianId}
                onChange={e => setToCustodianId(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">Transfer Method</label>
              <select
                value={transferMethod}
                onChange={e => setTransferMethod(e.target.value as any)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              >
                <option value="Direct Handover">Direct Handover</option>
                <option value="Secure Courier">Secure Courier</option>
                <option value="Encrypted Air-Gapped Media">Encrypted Air-Gapped Media</option>
                <option value="Evidence Locker Transfer">Evidence Locker Transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-300 block mb-1 font-medium">Destination Facility / Location</label>
            <input
              type="text"
              required
              value={destinationLocation}
              onChange={e => setDestinationLocation(e.target.value)}
              placeholder="Forensic Lab Analysis Station #3 / County Court Room 4"
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1 font-medium">Transfer Reason & Authorization</label>
            <textarea
              rows={2}
              required
              value={transferReason}
              onChange={e => setTransferReason(e.target.value)}
              placeholder="State forensic objective: e.g. Checkout image for keyword carving and file-recovery analysis."
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-300 block mb-1 font-medium">Sender Handover Notes</label>
            <input
              type="text"
              value={senderNotes}
              onChange={e => setSenderNotes(e.target.value)}
              placeholder="Security seal numbers, physical condition verification..."
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg cursor-pointer"
            >
              {isSubmitting ? 'Locking & Requesting...' : 'Initiate Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
