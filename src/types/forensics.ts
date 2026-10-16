/**
 * CyberTrace - Digital Forensics & Chain of Custody Type Definitions
 */

export type UserRole =
  | 'Administrator'
  | 'Lead Investigator'
  | 'Investigator'
  | 'Evidence Custodian'
  | 'Read-Only Auditor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  badgeNumber: string;
  department: string;
  active: boolean;
  lastSignIn: string;
  createdAt: string;
}

export type InvestigationCategory =
  | 'Data Breach'
  | 'Ransomware'
  | 'Insider Threat'
  | 'Financial Fraud'
  | 'Intellectual Property Theft'
  | 'System Intrusion'
  | 'Regulatory Compliance';

export type InvestigationPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type InvestigationStatus = 'Active' | 'Under Review' | 'Pending Legal' | 'Closed' | 'Archived';

export interface Investigation {
  id: string; // e.g. CASE-2026-0104
  title: string;
  description: string;
  category: InvestigationCategory;
  priority: InvestigationPriority;
  status: InvestigationStatus;
  leadInvestigatorId: string;
  assignedInvestigatorIds: string[];
  evidenceIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closureSummary?: string;
  retentionYears: number;
}

export type EvidenceCategory =
  | 'Computer Workstation'
  | 'Server / VM Image'
  | 'Mobile Device'
  | 'External Storage / USB'
  | 'Network Packet Capture'
  | 'Forensic Memory Dump'
  | 'System & Security Logs'
  | 'Database Extract'
  | 'Encrypted Container';

export type CustodyState =
  | 'In Vault'
  | 'Checked Out for Analysis'
  | 'Transfer In Transit'
  | 'In Court / Legal Hold'
  | 'Archived'
  | 'Disposed';

export interface EvidenceItem {
  id: string; // e.g. EVD-2026-0812
  caseId: string;
  description: string;
  category: EvidenceCategory;
  originalFileName: string;
  storedFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Baseline: string; // Cryptographic baseline
  sourceDevice: string;
  serialNumber?: string;
  collectorName: string;
  collectorBadge: string;
  collectionLocation: string;
  collectionMethod: 'Physical Write-Blocker' | 'Logical Bit-Stream' | 'Live Memory Acquisition' | 'Network Tap' | 'API Extract';
  acquisitionNotes: string;
  storageReference: string;
  currentCustodianId: string;
  currentCustodianName: string;
  currentLocation: string;
  custodyState: CustodyState;
  isLockedForTransfer: boolean;
  activeTransferId?: string;
  registeredAt: string;
  lastVerifiedAt?: string;
  lastVerificationResult?: 'MATCH' | 'MISMATCH';
  isSyntheticDemo?: boolean;
}

export type TransferStatus =
  | 'Draft'
  | 'Requested'
  | 'Awaiting Acknowledgment'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export interface CustodyTransfer {
  id: string; // e.g. TRF-2026-4401
  evidenceId: string;
  caseId: string;
  initiatingUserId: string;
  initiatingUserName: string;
  fromCustodianId: string;
  fromCustodianName: string;
  toCustodianId: string;
  toCustodianName: string;
  transferReason: string;
  transferMethod: 'Direct Handover' | 'Secure Courier' | 'Encrypted Air-Gapped Media' | 'Evidence Locker Transfer';
  destinationLocation: string;
  status: TransferStatus;
  requestedAt: string;
  senderAcknowledgment?: {
    acknowledgedBy: string;
    timestamp: string;
    notes?: string;
  };
  recipientAcknowledgment?: {
    acknowledgedBy: string;
    timestamp: string;
    digitalSignatureHash: string;
    notes?: string;
  };
  completedAt?: string;
  rejectedReason?: string;
  cancelledReason?: string;
}

export interface IntegrityCheck {
  id: string;
  evidenceId: string;
  caseId: string;
  algorithm: 'SHA-256' | 'SHA-512';
  expectedHash: string;
  observedHash: string;
  byteLength: number;
  result: 'MATCH' | 'MISMATCH';
  initiatedByUserId: string;
  initiatedByUserName: string;
  verificationMethod: 'Automated Scheduled Check' | 'Manual Verification' | 'Pre-Court Submission' | 'Post-Transfer Intake';
  timestamp: string;
  discrepancyDetails?: string;
}

export interface AuditEvent {
  id: string;
  sequenceNumber: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action:
    | 'USER_AUTHENTICATED'
    | 'CASE_CREATED'
    | 'CASE_UPDATED'
    | 'CASE_CLOSED'
    | 'EVIDENCE_REGISTERED'
    | 'EVIDENCE_ACCESSED'
    | 'EVIDENCE_DOWNLOADED'
    | 'EVIDENCE_INTEGRITY_VERIFIED'
    | 'EVIDENCE_INTEGRITY_FAILED'
    | 'CUSTODY_TRANSFER_INITIATED'
    | 'CUSTODY_TRANSFER_ACKNOWLEDGED'
    | 'CUSTODY_TRANSFER_REJECTED'
    | 'USER_ROLE_CHANGED'
    | 'USER_STATUS_TOGGLED'
    | 'REPORT_GENERATED'
    | 'RETENTION_POLICY_UPDATED'
    | 'AUTHORIZATION_DENIED';
  targetType: 'Investigation' | 'Evidence' | 'CustodyTransfer' | 'User' | 'Report' | 'Security';
  targetId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  details: string;
  clientIp?: string;
  prevHash: string; // Hash chain linkage
  hash: string; // SHA-256 of canonical event representation
}

export interface AuditVerificationResult {
  verified: boolean;
  totalEvents: number;
  brokenLinkIndex?: number;
  expectedHash?: string;
  computedHash?: string;
  message: string;
  verifiedAt: string;
}

export interface DashboardStats {
  totalInvestigations: number;
  activeInvestigations: number;
  closedInvestigations: number;
  totalEvidenceItems: number;
  inVaultEvidence: number;
  inTransitEvidence: number;
  pendingTransfersCount: number;
  recentVerificationsCount: number;
  integrityMismatchesCount: number;
  pendingAcknowledgmentsCount: number;
  recentAuditEvents: AuditEvent[];
  evidenceByCategory: Record<string, number>;
  casesByPriority: Record<string, number>;
  activityTimeline: { date: string; actionsCount: number }[];
}

export interface SecuritySettings {
  defaultHashAlgorithm: 'SHA-256' | 'SHA-512';
  requireTwoPersonRuleForTransfers: boolean;
  maxFileUploadSizeBytes: number;
  auditChainCheckpointInterval: number;
  defaultRetentionPeriodYears: number;
  autoIntegrityCheckIntervalDays: number;
  enforceWriteBlockerDeclaration: boolean;
}
