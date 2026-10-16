import React, { useState } from 'react';
import { SecuritySettings, User } from '../../types/forensics';
import {
  Settings,
  Shield,
  Lock,
  HardDrive,
  Save,
  CheckCircle,
  AlertTriangle,
  Code,
  FileCode,
  Copy,
  ExternalLink
} from 'lucide-react';
import { api } from '../../services/api';

interface SecuritySettingsViewProps {
  settings: SecuritySettings | null;
  currentUser: User;
  onRefresh: () => void;
}

export const SecuritySettingsView: React.FC<SecuritySettingsViewProps> = ({
  settings,
  currentUser,
  onRefresh
}) => {
  const [formData, setFormData] = useState<SecuritySettings>(
    settings || {
      defaultHashAlgorithm: 'SHA-256',
      requireTwoPersonRuleForTransfers: true,
      maxFileUploadSizeBytes: 100 * 1024 * 1024,
      auditChainCheckpointInterval: 50,
      defaultRetentionPeriodYears: 7,
      autoIntegrityCheckIntervalDays: 7,
      enforceWriteBlockerDeclaration: true
    }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isAdmin = currentUser.role === 'Administrator';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Forbidden: Administrator role required to modify system security policies.');
      return;
    }

    try {
      setIsSaving(true);
      await api.updateSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const sampleFirestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // CyberTrace Zero-Trust ABAC Security Rules
    match /{document=**} {
      allow read, write: if false; // Default-deny catch-all
    }

    function isSignedIn() { return request.auth != null; }
    function isAdmin() { return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid)); }

    // Audit Events: Append-Only Immutable Records
    match /auditEvents/{eventId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn(); // Validated on server
      allow update, delete: if false; // Strict immutability
    }

    // Evidence Artifacts
    match /evidence/{evidenceId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn();
      allow delete: if isAdmin();
    }

    // Custody Transfers
    match /custodyTransfers/{transferId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn();
      allow delete: if false;
    }
  }
}`;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-cyan-400" />
          Forensic Security Policies & Cryptographic Configuration
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Cryptographic hash parameters, write-blocker declarations, retention rules, and cloud integration.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Security policies updated and recorded in the append-only audit trail.</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cryptographic Engine Policy */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Cryptographic Integrity Standards
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Default Hash Algorithm</label>
                <select
                  disabled={!isAdmin}
                  value={formData.defaultHashAlgorithm}
                  onChange={e => setFormData({ ...formData, defaultHashAlgorithm: e.target.value as any })}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
                >
                  <option value="SHA-256">SHA-256 (FIPS 180-4 NIST Standard - Recommended)</option>
                  <option value="SHA-512">SHA-512 (High-Security Extended Digest)</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Executed server-side via Node.js crypto module with stream buffering.
                </span>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Max Upload Artifact Size</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!isAdmin}
                    value={Math.round(formData.maxFileUploadSizeBytes / (1024 * 1024))}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        maxFileUploadSizeBytes: (Number(e.target.value) || 100) * 1024 * 1024
                      })
                    }
                    className="w-24 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                  />
                  <span className="text-slate-400 text-xs">Megabytes (MB)</span>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formData.enforceWriteBlockerDeclaration}
                    onChange={e =>
                      setFormData({ ...formData, enforceWriteBlockerDeclaration: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-slate-300 font-medium">
                    Enforce Hardware Write-Blocker Declaration on Physical Intake
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Custody & Retention Policies */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              Custody Handover & Legal Retention
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Default Retention Period</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={!isAdmin}
                    value={formData.defaultRetentionPeriodYears}
                    onChange={e =>
                      setFormData({ ...formData, defaultRetentionPeriodYears: Number(e.target.value) || 7 })
                    }
                    className="w-24 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
                  />
                  <span className="text-slate-400 text-xs">Years (Statutory Evidence Hold)</span>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formData.requireTwoPersonRuleForTransfers}
                    onChange={e =>
                      setFormData({ ...formData, requireTwoPersonRuleForTransfers: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-slate-300 font-medium">
                    Enforce Dual-Party Rule (Sender + Recipient Digital Sign-Off)
                  </span>
                </label>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Prevents single-party unilateral custody reassignment. Official custodian updates only upon recipient acknowledgment.
                </span>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Committing Changes...' : 'Save Security Policies'}</span>
            </button>
          </div>
        )}
      </form>

      {/* Cloud Integration & Firebase Deployment Documentation */}
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            Cloud Firestore & Firebase Production Blueprint
          </h3>
          <button
            onClick={() => {
              navigator.clipboard.writeText(sampleFirestoreRules);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedCode ? 'Copied!' : 'Copy firestore.rules'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          The local trusted Node.js backend executes authoritative cryptographic SHA-256 verification and immutable hash-chain audits in <code>./data/</code> and <code>./data/evidence_storage/</code>. To link an external Google Cloud project with Cloud Firestore and Firebase Authentication:
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-64">
          <pre>{sampleFirestoreRules}</pre>
        </div>
      </div>
    </div>
  );
};
