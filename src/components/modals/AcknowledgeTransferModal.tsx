import React, { useState } from 'react';
import { CustodyTransfer, User } from '../../types/forensics';
import { FileSignature, X, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { api } from '../../services/api';

interface AcknowledgeTransferModalProps {
  transfer: CustodyTransfer;
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const AcknowledgeTransferModal: React.FC<AcknowledgeTransferModalProps> = ({
  transfer,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [recipientNotes, setRecipientNotes] = useState(
    'Evidence physical seals inspected; anti-static packaging intact; physical custody officially accepted.'
  );
  const [confirmedParity, setConfirmedParity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedParity) {
      setErrorMsg('You must certify artifact inspection and assume official custody.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await api.acknowledgeCustodyTransfer(transfer.id, {
        recipientNotes,
        digitalSignatureConfirm: true
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
            <FileSignature className="w-4 h-4 text-cyan-400" />
            Digital Custody Handover Acknowledgment
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

        {/* Transfer Summary Box */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Transfer ID:</span>
            <span className="text-cyan-400 font-bold">{transfer.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Target Artifact:</span>
            <span className="text-slate-200 font-bold">{transfer.evidenceId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Releasing Custodian:</span>
            <span className="text-slate-300">{transfer.fromCustodianName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Designated Recipient:</span>
            <span className="text-cyan-300 font-bold">{transfer.toCustodianName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Destination:</span>
            <span className="text-slate-300">{transfer.destinationLocation}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-300 block mb-1 font-medium font-sans">
              Recipient Physical Verification Notes
            </label>
            <textarea
              rows={3}
              required
              value={recipientNotes}
              onChange={e => setRecipientNotes(e.target.value)}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 font-sans"
            />
          </div>

          <div
            onClick={() => setConfirmedParity(!confirmedParity)}
            className="p-3 rounded-xl bg-slate-950 border border-cyan-900/60 flex items-start gap-3 cursor-pointer hover:bg-slate-950/80 transition-colors select-none"
          >
            {confirmedParity ? (
              <CheckSquare className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            ) : (
              <Square className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            )}
            <div className="text-[11px] text-slate-300 leading-relaxed font-sans">
              <strong>Attestation of Electronic & Physical Custody:</strong> I hereby certify that I have physically received and inspected artifact <strong>{transfer.evidenceId}</strong>. I assume sole legal responsibility as official custodian under statutory digital evidence protocols.
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono">
              Signer: {currentUser.name} (#{currentUser.badgeNumber})
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !confirmedParity}
                className="px-4 py-2 font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Signing...' : 'Sign & Accept Custody'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
