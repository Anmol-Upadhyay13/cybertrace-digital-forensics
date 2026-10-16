import React, { useState } from 'react';
import { InvestigationCategory, InvestigationPriority, User } from '../../types/forensics';
import { Briefcase, X } from 'lucide-react';
import { api } from '../../services/api';

interface NewCaseModalProps {
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  currentUser,
  onClose,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<InvestigationCategory>('Ransomware');
  const [priority, setPriority] = useState<InvestigationPriority>('High');
  const [tagsInput, setTagsInput] = useState('');
  const [retentionYears, setRetentionYears] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await api.createCase({
        title,
        description,
        category,
        priority,
        tags,
        retentionYears
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
            <Briefcase className="w-4 h-4 text-cyan-400" />
            Open Investigation Dossier
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-slate-300 block mb-1 font-medium">Investigation Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Operation DarkShield: Sovereign Fund Breach Analysis"
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as InvestigationCategory)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              >
                <option value="Data Breach">Data Breach</option>
                <option value="Ransomware">Ransomware</option>
                <option value="Insider Threat">Insider Threat</option>
                <option value="Financial Fraud">Financial Fraud</option>
                <option value="Intellectual Property Theft">IP Theft</option>
                <option value="System Intrusion">System Intrusion</option>
                <option value="Regulatory Compliance">Compliance</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">Priority Level</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as InvestigationPriority)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              >
                <option value="Critical">Critical Priority</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-300 block mb-1 font-medium">Executive Description</label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Outline initial incident indicators, suspected vector, and seizure authorization..."
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Tags (comma separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="CobaltStrike, Phishing, NVMe"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Retention Policy (Years)</label>
              <input
                type="number"
                value={retentionYears}
                onChange={e => setRetentionYears(Number(e.target.value) || 7)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-hidden focus:border-cyan-500"
              />
            </div>
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
              {isSubmitting ? 'Opening Case...' : 'Open Case Dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
