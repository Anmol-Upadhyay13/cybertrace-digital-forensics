import React, { useState, useRef } from 'react';
import { Investigation, EvidenceCategory, User } from '../../types/forensics';
import {
  UploadCloud,
  File,
  X,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Cpu,
  Lock
} from 'lucide-react';
import { api } from '../../services/api';

interface EvidenceIntakeModalProps {
  cases: Investigation[];
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const EvidenceIntakeModal: React.FC<EvidenceIntakeModalProps> = ({
  cases,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EvidenceCategory>('Computer Workstation');
  const [sourceDevice, setSourceDevice] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [collectionLocation, setCollectionLocation] = useState('');
  const [collectionMethod, setCollectionMethod] = useState<any>('Physical Write-Blocker');
  const [acquisitionNotes, setAcquisitionNotes] = useState('');
  const [storageReference, setStorageReference] = useState('');

  // Mode: Upload Binary vs Physical Hardware Manifest
  const [intakeMode, setIntakeMode] = useState<'upload' | 'hardware'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Manual acquisition fields
  const [manualHash, setManualHash] = useState('');
  const [manualFileName, setManualFileName] = useState('');
  const [manualFileSizeMb, setManualFileSizeMb] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedCaseId) {
      setErrorMsg('Please select an active investigation case file.');
      return;
    }

    if (intakeMode === 'upload' && !selectedFile) {
      setErrorMsg('Please select or drag an evidence file to upload.');
      return;
    }

    if (intakeMode === 'hardware' && !manualHash) {
      setErrorMsg('Mandatory SHA-256 acquisition baseline hash required for physical evidence.');
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('caseId', selectedCaseId);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('sourceDevice', sourceDevice || 'Suspect Workstation');
      formData.append('serialNumber', serialNumber);
      formData.append('collectionLocation', collectionLocation || 'Forensic Lab Intake');
      formData.append('collectionMethod', collectionMethod);
      formData.append('acquisitionNotes', acquisitionNotes || 'Intake verified with hardware write-blocker.');
      formData.append('storageReference', storageReference || 'VAULT-SEC-ZONE-A');

      if (intakeMode === 'upload' && selectedFile) {
        formData.append('evidenceFile', selectedFile);
      } else {
        formData.append('manualBaselineHash', manualHash);
        formData.append('manualFileName', manualFileName || `${sourceDevice || 'Physical_Drive'}.raw`);
        formData.append('manualFileSize', String((Number(manualFileSizeMb) || 1024) * 1024 * 1024));
      }

      await api.registerEvidence(formData);
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
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-cyan-400" />
              Electronic Evidence Intake Protocol
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Secure intake with streaming server-side SHA-256 calculation and immutable registration.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Mode Selector */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setIntakeMode('upload')}
              className={`flex-1 py-1.5 font-medium rounded-md transition-colors cursor-pointer text-center ${
                intakeMode === 'upload'
                  ? 'bg-slate-800 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload Digital Binary File
            </button>
            <button
              type="button"
              onClick={() => setIntakeMode('hardware')}
              className={`flex-1 py-1.5 font-medium rounded-md transition-colors cursor-pointer text-center ${
                intakeMode === 'hardware'
                  ? 'bg-slate-800 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Physical Drive / Hardware Intake
            </button>
          </div>

          {/* Case Association */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Investigation Case File</label>
              <select
                required
                value={selectedCaseId}
                onChange={e => setSelectedCaseId(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              >
                {cases.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.title.slice(0, 32)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">Evidence Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as EvidenceCategory)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              >
                <option value="Computer Workstation">Computer Workstation</option>
                <option value="Server / VM Image">Server / VM Image</option>
                <option value="Mobile Device">Mobile Device</option>
                <option value="External Storage / USB">External Storage / USB</option>
                <option value="Network Packet Capture">Network Packet Capture</option>
                <option value="Forensic Memory Dump">Forensic Memory Dump</option>
                <option value="System & Security Logs">System & Security Logs</option>
                <option value="Encrypted Container">Encrypted Container</option>
              </select>
            </div>
          </div>

          {/* Upload Dropzone */}
          {intakeMode === 'upload' ? (
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Evidence File Upload</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-950/30'
                    : selectedFile
                    ? 'border-emerald-800 bg-emerald-950/20'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={e => e.target.files && setSelectedFile(e.target.files[0])}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center gap-1.5 text-emerald-300">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <span className="font-semibold text-white">{selectedFile.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Ready for SHA-256 stream calculation
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <UploadCloud className="w-8 h-8 text-slate-500 mb-1" />
                    <span className="text-slate-200 font-medium">Click to select or drag evidence file</span>
                    <span className="text-[11px] text-slate-500">
                      Raw memory dumps, PCAP captures, disk images, or encrypted archives up to 100MB
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-cyan-400 font-medium flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                <span>Physical Disk / Forensic Image Manifest</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Image Filename</label>
                  <input
                    type="text"
                    value={manualFileName}
                    onChange={e => setManualFileName(e.target.value)}
                    placeholder="suspect_macbook_pro_1tb.E01"
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Capacity / Size (GB)</label>
                  <input
                    type="number"
                    value={manualFileSizeMb}
                    onChange={e => setManualFileSizeMb(e.target.value)}
                    placeholder="1000"
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-mono">Verified SHA-256 Baseline Hash (Mandatory)</label>
                <input
                  type="text"
                  required
                  value={manualHash}
                  onChange={e => setManualHash(e.target.value)}
                  placeholder="e.g. 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded text-slate-200 font-mono text-[11px]"
                />
              </div>
            </div>
          )}

          {/* Artifact Details */}
          <div>
            <label className="text-slate-300 block mb-1 font-medium">Artifact Description</label>
            <input
              type="text"
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Bit-stream physical image of target NVMe drive taken with write-blocker"
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Source Device / Host</label>
              <input
                type="text"
                value={sourceDevice}
                onChange={e => setSourceDevice(e.target.value)}
                placeholder="Dell XPS 15 / Win-DC01"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Hardware Serial #</label>
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="SN-WD-448102"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Collection Method</label>
              <select
                value={collectionMethod}
                onChange={e => setCollectionMethod(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              >
                <option value="Physical Write-Blocker">Physical Write-Blocker</option>
                <option value="Logical Bit-Stream">Logical Bit-Stream</option>
                <option value="Live Memory Acquisition">Live Memory Acquisition</option>
                <option value="Network Tap">Network Tap</option>
                <option value="API Extract">API Extract</option>
              </select>
            </div>
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Collection Location</label>
              <input
                type="text"
                required
                value={collectionLocation}
                onChange={e => setCollectionLocation(e.target.value)}
                placeholder="Primary Data Center / Rack 2"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 block mb-1 font-medium">Acquisition & Intake Notes</label>
            <textarea
              rows={2}
              value={acquisitionNotes}
              onChange={e => setAcquisitionNotes(e.target.value)}
              placeholder="Record forensic seals, write-blocker model, and acquisition environment..."
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <span className="text-[11px] text-slate-500 font-mono">
              Intake Officer: {currentUser.name} (#{currentUser.badgeNumber})
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm cursor-pointer"
              >
                {isSubmitting ? 'Hashing & Registering...' : 'Register Evidence'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
