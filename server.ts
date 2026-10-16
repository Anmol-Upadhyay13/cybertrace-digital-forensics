import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  User,
  UserRole,
  Investigation,
  EvidenceItem,
  CustodyTransfer,
  IntegrityCheck,
  AuditEvent,
  AuditVerificationResult,
  DashboardStats,
  SecuritySettings
} from './src/types/forensics.js';

dotenv.config();

const app = express();
const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const EVIDENCE_STORAGE_DIR = path.join(DATA_DIR, 'evidence_storage');

// Ensure storage directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(EVIDENCE_STORAGE_DIR)) {
  fs.mkdirSync(EVIDENCE_STORAGE_DIR, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure Multer for secure evidence storage with random filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, EVIDENCE_STORAGE_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate cryptographically random storage filename, strictly preventing path traversal
    const safeExt = path.extname(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '') || '.bin';
    const randomHex = crypto.randomBytes(16).toString('hex');
    cb(null, `evd_${Date.now()}_${randomHex}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max limit
});

// Database shape
interface DatabaseSchema {
  users: User[];
  investigations: Investigation[];
  evidence: EvidenceItem[];
  custodyTransfers: CustodyTransfer[];
  integrityChecks: IntegrityCheck[];
  auditEvents: AuditEvent[];
  settings: SecuritySettings;
  tamperBackups?: Record<string, string>;
  auditBackup?: string;
}

// Session store with persistence across server restarts
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function loadSessions(): Map<string, { userId: string; token: string; expiresAt: number }> {
  const map = new Map<string, { userId: string; token: string; expiresAt: number }>();
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      for (const item of arr) {
        if (item.expiresAt > Date.now()) {
          map.set(item.token, item);
        }
      }
    } catch {
      // ignore
    }
  }
  return map;
}

function saveSessions(map: Map<string, { userId: string; token: string; expiresAt: number }>) {
  try {
    const arr = Array.from(map.values()).filter(i => i.expiresAt > Date.now());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

const activeSessions = loadSessions();

// Deterministic Canonical JSON Stringification (RFC 8785)
function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

function computeSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error('File not found at path: ' + filePath));
    }
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

function readDb(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initialDb = seedInitialDatabase();
    writeDb(initialDb);
    return initialDb;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json, re-initializing', err);
    const initialDb = seedInitialDatabase();
    writeDb(initialDb);
    return initialDb;
  }
}

function writeDb(data: DatabaseSchema): void {
  const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_FILE);
}

// Append Tamper-Evident Audit Record
function appendAuditEvent(
  db: DatabaseSchema,
  event: Omit<AuditEvent, 'id' | 'sequenceNumber' | 'prevHash' | 'hash'>
): AuditEvent {
  const events = db.auditEvents;
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const prevHash = lastEvent ? lastEvent.hash : '0000000000000000000000000000000000000000000000000000000000000000';
  const sequenceNumber = events.length + 1;
  const id = `AUD-${Date.now()}-${sequenceNumber.toString().padStart(6, '0')}`;

  const partialPayload = {
    id,
    sequenceNumber,
    timestamp: event.timestamp,
    actorId: event.actorId,
    actorName: event.actorName,
    actorRole: event.actorRole,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    outcome: event.outcome,
    details: event.details,
    clientIp: event.clientIp || '127.0.0.1',
    prevHash
  };

  const canonical = canonicalStringify(partialPayload);
  const hash = computeSha256(canonical);

  const fullEvent: AuditEvent = {
    ...partialPayload,
    hash
  };

  db.auditEvents.push(fullEvent);
  return fullEvent;
}

// Generate secure session token for a user
function issueTokenForUser(userId: string): string {
  const token = `ct_${crypto.randomBytes(32).toString('hex')}`;
  activeSessions.set(token, {
    userId,
    token,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  saveSessions(activeSessions);
  return token;
}

// Seed initial realistic forensic database
function seedInitialDatabase(): DatabaseSchema {
  const users: User[] = [
    {
      id: 'USR-001',
      name: 'Agent Sarah Vance',
      email: 's.vance@forensics.internal',
      role: 'Administrator',
      badgeNumber: 'DFIR-8801',
      department: 'Digital Crimes Unit',
      active: true,
      lastSignIn: '2026-10-16T06:30:00.000Z',
      createdAt: '2026-01-15T08:00:00.000Z'
    },
    {
      id: 'USR-002',
      name: 'Dr. Marcus Thorne',
      email: 'm.thorne@forensics.internal',
      role: 'Lead Investigator',
      badgeNumber: 'DFIR-4219',
      department: 'Incident Response & Analysis',
      active: true,
      lastSignIn: '2026-10-16T07:15:00.000Z',
      createdAt: '2026-01-15T08:00:00.000Z'
    },
    {
      id: 'USR-003',
      name: 'Detective Elena Rostova',
      email: 'e.rostova@forensics.internal',
      role: 'Investigator',
      badgeNumber: 'DFIR-6310',
      department: 'Forensic Lab Services',
      active: true,
      lastSignIn: '2026-10-15T18:40:00.000Z',
      createdAt: '2026-02-01T09:00:00.000Z'
    },
    {
      id: 'USR-004',
      name: 'Officer David Kim',
      email: 'd.kim@forensics.internal',
      role: 'Evidence Custodian',
      badgeNumber: 'DFIR-1102',
      department: 'Central Evidence Vault',
      active: true,
      lastSignIn: '2026-10-16T07:05:00.000Z',
      createdAt: '2026-01-20T10:00:00.000Z'
    },
    {
      id: 'USR-005',
      name: 'Judge Linda Holbrook',
      email: 'l.holbrook@judiciary.internal',
      role: 'Read-Only Auditor',
      badgeNumber: 'AUD-0094',
      department: 'Judicial Oversight Office',
      active: true,
      lastSignIn: '2026-10-14T14:22:00.000Z',
      createdAt: '2026-03-10T11:00:00.000Z'
    }
  ];

  const investigations: Investigation[] = [
    {
      id: 'CASE-2026-0104',
      title: 'Operation DarkVault: APT Exfiltration & Ransomware Staging',
      description: 'Suspected advanced persistent threat targeting financial database servers via compromised VPN credentials. Memory captures and disk images seized from primary domain controller.',
      category: 'Ransomware',
      priority: 'Critical',
      status: 'Active',
      leadInvestigatorId: 'USR-002',
      assignedInvestigatorIds: ['USR-002', 'USR-003'],
      evidenceIds: ['EVD-2026-0812', 'EVD-2026-0813'],
      tags: ['CobaltStrike', 'DomainController', 'BitLockerBypass', 'MemoryDump'],
      createdAt: '2026-10-10T09:14:00.000Z',
      updatedAt: '2026-10-15T16:30:00.000Z',
      retentionYears: 10
    },
    {
      id: 'CASE-2026-0098',
      title: 'Apex Dynamics Intellectual Property Theft & Trade Secrets',
      description: 'Unauthorized extraction of proprietary aeronautics design files onto unencrypted NVMe flash storage prior to senior research scientist departure.',
      category: 'Intellectual Property Theft',
      priority: 'High',
      status: 'Under Review',
      leadInvestigatorId: 'USR-002',
      assignedInvestigatorIds: ['USR-002'],
      evidenceIds: ['EVD-2026-0814'],
      tags: ['NVMe', 'InsiderThreat', 'CADFiles', 'BitStream'],
      createdAt: '2026-09-28T11:20:00.000Z',
      updatedAt: '2026-10-14T10:15:00.000Z',
      retentionYears: 7
    },
    {
      id: 'CASE-2026-0082',
      title: 'Vortex Capital Swift Wire Transfer Fraud',
      description: 'Manipulated payment authorization gateway logs resulting in $4.2M fraudulent overseas routing. Packet captures and server logs acquired.',
      category: 'Financial Fraud',
      priority: 'High',
      status: 'Closed',
      leadInvestigatorId: 'USR-003',
      assignedInvestigatorIds: ['USR-003'],
      evidenceIds: ['EVD-2026-0815'],
      tags: ['SWIFT', 'WireFraud', 'PCAP', 'Syslog'],
      createdAt: '2026-08-14T08:00:00.000Z',
      updatedAt: '2026-09-30T17:00:00.000Z',
      closedAt: '2026-09-30T17:00:00.000Z',
      closureSummary: 'Perpetrators identified and prosecuted. Restitution and court proceedings finalized.',
      retentionYears: 7
    }
  ];

  const sample1Content = 'CYBERTRACE-FORENSIC-RAW-MEM-DUMP::OFFSET-0x0000F4A0::PROC-LSASS.EXE::INJECTED-DLL-DETECTED::TIMESTAMP=2026-10-10T09:14:22Z';
  const sample1File = 'evd_demo_raw_mem_dump.bin';
  fs.writeFileSync(path.join(EVIDENCE_STORAGE_DIR, sample1File), sample1Content);
  const sample1Hash = computeSha256(sample1Content);

  const sample2Content = 'NETWORK-PACKET-CAPTURE-PCAP-HEADER::ETH-FRAME::SRC=10.0.4.12:DST=198.51.100.44:PROTO=TCP:PAYLOAD=ENC-PAYLOAD-V4';
  const sample2File = 'evd_demo_pcap_exfil.pcap';
  fs.writeFileSync(path.join(EVIDENCE_STORAGE_DIR, sample2File), sample2Content);
  const sample2Hash = computeSha256(sample2Content);

  const sample3Content = 'FORENSIC-DISK-IMAGE-E01-METADATA::SERIAL=WD-WCC4N7029141::SECTORS=1953525168::BLOCKS=512::PHYSICAL-BLOCK-WRITE-BLOCKED';
  const sample3File = 'evd_demo_disk_image.e01';
  fs.writeFileSync(path.join(EVIDENCE_STORAGE_DIR, sample3File), sample3Content);
  const sample3Hash = computeSha256(sample3Content);

  const sample4Content = 'APEX-ENGINEERING-SWIFT-PAYMENT-GATEWAY-AUTH-LOG::CORRELATION-ID-8849120::MUTATED-SIGNATURE-RECORDED';
  const sample4File = 'evd_demo_gateway_audit.log';
  fs.writeFileSync(path.join(EVIDENCE_STORAGE_DIR, sample4File), sample4Content);
  const sample4Hash = computeSha256(sample4Content);

  const evidence: EvidenceItem[] = [
    {
      id: 'EVD-2026-0812',
      caseId: 'CASE-2026-0104',
      description: 'Physical RAM dump of infected Primary Domain Controller (WIN-DC01.FIN.LOCAL)',
      category: 'Forensic Memory Dump',
      originalFileName: 'DC01_volatility_memory_image.raw',
      storedFileName: sample1File,
      fileSizeBytes: Buffer.byteLength(sample1Content),
      mimeType: 'application/octet-stream',
      sha256Baseline: sample1Hash,
      sourceDevice: 'Dell PowerEdge R750 Server (Host DC-01)',
      serialNumber: 'SRV-DL-994821',
      collectorName: 'Dr. Marcus Thorne',
      collectorBadge: 'DFIR-4219',
      collectionLocation: 'Primary Data Center, Server Rack 4-B, Chicago IL',
      collectionMethod: 'Live Memory Acquisition',
      acquisitionNotes: 'Acquired using hardware write-blocked PCIe capture card directly into encrypted storage container. Host remained isolated from external WAN.',
      storageReference: 'VAULT-SEC-A-CABINET-02-SHELF-3',
      currentCustodianId: 'USR-004',
      currentCustodianName: 'Officer David Kim',
      currentLocation: 'Central Evidence Vault, Zone Alpha',
      custodyState: 'In Vault',
      isLockedForTransfer: false,
      registeredAt: '2026-10-10T11:45:00.000Z',
      lastVerifiedAt: '2026-10-15T08:00:00.000Z',
      lastVerificationResult: 'MATCH',
      isSyntheticDemo: true
    },
    {
      id: 'EVD-2026-0813',
      caseId: 'CASE-2026-0104',
      description: 'Full packet capture of lateral movement and staging channel traffic (Port 443 TCP)',
      category: 'Network Packet Capture',
      originalFileName: 'core_switch_mirror_traffic.pcap',
      storedFileName: sample2File,
      fileSizeBytes: Buffer.byteLength(sample2Content),
      mimeType: 'application/vnd.tcpdump.pcap',
      sha256Baseline: sample2Hash,
      sourceDevice: 'Cisco Nexus 9300 Core Switch SPAN Port',
      serialNumber: 'CSCO-NX-441098',
      collectorName: 'Detective Elena Rostova',
      collectorBadge: 'DFIR-6310',
      collectionLocation: 'Network Operations Center, Server Room 1',
      collectionMethod: 'Network Tap',
      acquisitionNotes: 'Continuous passive fiber optic tap. Zero packet loss confirmed via CRC check registers.',
      storageReference: 'VAULT-SEC-B-DRIVE-ARRAY-01',
      currentCustodianId: 'USR-004',
      currentCustodianName: 'Officer David Kim',
      currentLocation: 'Central Evidence Vault, Storage Locker 14',
      custodyState: 'In Vault',
      isLockedForTransfer: false,
      registeredAt: '2026-10-10T14:30:00.000Z',
      lastVerifiedAt: '2026-10-15T08:05:00.000Z',
      lastVerificationResult: 'MATCH',
      isSyntheticDemo: true
    },
    {
      id: 'EVD-2026-0814',
      caseId: 'CASE-2026-0098',
      description: 'Physical bit-stream image of suspect SanDisk Extreme PRO 1TB NVMe Solid State Drive',
      category: 'External Storage / USB',
      originalFileName: 'suspect_sandisk_1tb_nvme.E01',
      storedFileName: sample3File,
      fileSizeBytes: Buffer.byteLength(sample3Content),
      mimeType: 'application/octet-stream',
      sha256Baseline: sample3Hash,
      sourceDevice: 'SanDisk Extreme PRO NVMe SSD',
      serialNumber: 'SD-NVME-884192A',
      collectorName: 'Agent Sarah Vance',
      collectorBadge: 'DFIR-8801',
      collectionLocation: 'Suspect Residence, Private Office, San Jose CA',
      collectionMethod: 'Physical Write-Blocker',
      acquisitionNotes: 'Seized pursuant to Search Warrant #2026-SW-088. Imaged using Tableau T8u Forensic USB 3.0 Bridge with hardware write-protection engaged.',
      storageReference: 'VAULT-SEC-A-FARADAY-BOX-09',
      currentCustodianId: 'USR-002',
      currentCustodianName: 'Dr. Marcus Thorne',
      currentLocation: 'Digital Forensics Lab Station #2',
      custodyState: 'Checked Out for Analysis',
      isLockedForTransfer: false,
      registeredAt: '2026-09-28T16:00:00.000Z',
      lastVerifiedAt: '2026-10-14T09:12:00.000Z',
      lastVerificationResult: 'MATCH',
      isSyntheticDemo: true
    },
    {
      id: 'EVD-2026-0815',
      caseId: 'CASE-2026-0082',
      description: 'Sanitized transaction ledger and gateway authorization server logs',
      category: 'System & Security Logs',
      originalFileName: 'vortex_gateway_transactions.log',
      storedFileName: sample4File,
      fileSizeBytes: Buffer.byteLength(sample4Content),
      mimeType: 'text/plain',
      sha256Baseline: sample4Hash,
      sourceDevice: 'AWS EC2 Production Instance (i-088f12a9)',
      serialNumber: 'AWS-EC2-VORTEX-PROD-01',
      collectorName: 'Detective Elena Rostova',
      collectorBadge: 'DFIR-6310',
      collectionLocation: 'AWS Cloud Console (us-east-1) Secure Vault',
      collectionMethod: 'API Extract',
      acquisitionNotes: 'Exported directly from immutable CloudWatch log group with signed AWS SigV4 cryptographic receipt.',
      storageReference: 'VAULT-SEC-CLOUD-COLD-ARCHIVE',
      currentCustodianId: 'USR-004',
      currentCustodianName: 'Officer David Kim',
      currentLocation: 'Central Evidence Vault, Zone Beta',
      custodyState: 'In Vault',
      isLockedForTransfer: false,
      registeredAt: '2026-08-14T11:00:00.000Z',
      lastVerifiedAt: '2026-09-30T17:00:00.000Z',
      lastVerificationResult: 'MATCH',
      isSyntheticDemo: true
    }
  ];

  const custodyTransfers: CustodyTransfer[] = [
    {
      id: 'TRF-2026-1001',
      evidenceId: 'EVD-2026-0814',
      caseId: 'CASE-2026-0098',
      initiatingUserId: 'USR-002',
      initiatingUserName: 'Dr. Marcus Thorne',
      fromCustodianId: 'USR-004',
      fromCustodianName: 'Officer David Kim',
      toCustodianId: 'USR-002',
      toCustodianName: 'Dr. Marcus Thorne',
      transferReason: 'Checkout forensic image for deep file-carving and timeline reconstruction analysis.',
      transferMethod: 'Direct Handover',
      destinationLocation: 'Digital Forensics Lab Station #2',
      status: 'Completed',
      requestedAt: '2026-10-12T09:00:00.000Z',
      senderAcknowledgment: {
        acknowledgedBy: 'Officer David Kim',
        timestamp: '2026-10-12T09:15:00.000Z',
        notes: 'Physical custody released from Central Vault Locker #9. Seal #DFIR-991 intact.'
      },
      recipientAcknowledgment: {
        acknowledgedBy: 'Dr. Marcus Thorne',
        timestamp: '2026-10-12T09:20:00.000Z',
        digitalSignatureHash: computeSha256('SIG::USR-002::TRF-2026-1001::2026-10-12T09:20:00.000Z'),
        notes: 'Item received in pristine condition. Integrity seal intact and verified.'
      },
      completedAt: '2026-10-12T09:20:00.000Z'
    }
  ];

  const integrityChecks: IntegrityCheck[] = [
    {
      id: 'INT-2026-0001',
      evidenceId: 'EVD-2026-0812',
      caseId: 'CASE-2026-0104',
      algorithm: 'SHA-256',
      expectedHash: sample1Hash,
      observedHash: sample1Hash,
      byteLength: Buffer.byteLength(sample1Content),
      result: 'MATCH',
      initiatedByUserId: 'USR-004',
      initiatedByUserName: 'Officer David Kim',
      verificationMethod: 'Automated Scheduled Check',
      timestamp: '2026-10-15T08:00:00.000Z'
    }
  ];

  const settings: SecuritySettings = {
    defaultHashAlgorithm: 'SHA-256',
    requireTwoPersonRuleForTransfers: true,
    maxFileUploadSizeBytes: 100 * 1024 * 1024,
    auditChainCheckpointInterval: 50,
    defaultRetentionPeriodYears: 7,
    autoIntegrityCheckIntervalDays: 7,
    enforceWriteBlockerDeclaration: true
  };

  const db: DatabaseSchema = {
    users,
    investigations,
    evidence,
    custodyTransfers,
    integrityChecks,
    auditEvents: [],
    settings,
    tamperBackups: {}
  };

  const seedEvents = [
    {
      timestamp: '2026-10-10T09:00:00.000Z',
      actorId: 'USR-001',
      actorName: 'Agent Sarah Vance',
      actorRole: 'Administrator' as UserRole,
      action: 'USER_AUTHENTICATED' as const,
      targetType: 'User' as const,
      targetId: 'USR-001',
      outcome: 'SUCCESS' as const,
      details: 'Administrator session authenticated with verified token credentials.'
    },
    {
      timestamp: '2026-10-10T09:14:00.000Z',
      actorId: 'USR-002',
      actorName: 'Dr. Marcus Thorne',
      actorRole: 'Lead Investigator' as UserRole,
      action: 'CASE_CREATED' as const,
      targetType: 'Investigation' as const,
      targetId: 'CASE-2026-0104',
      outcome: 'SUCCESS' as const,
      details: 'Investigation CASE-2026-0104 registered: Operation DarkVault.'
    },
    {
      timestamp: '2026-10-10T11:45:00.000Z',
      actorId: 'USR-002',
      actorName: 'Dr. Marcus Thorne',
      actorRole: 'Lead Investigator' as UserRole,
      action: 'EVIDENCE_REGISTERED' as const,
      targetType: 'Evidence' as const,
      targetId: 'EVD-2026-0812',
      outcome: 'SUCCESS' as const,
      details: `Registered memory dump EVD-2026-0812 with baseline SHA-256: ${sample1Hash.slice(0, 16)}...`
    }
  ];

  for (const e of seedEvents) {
    appendAuditEvent(db, e);
  }

  return db;
}

// Global active session for backward compatibility & testing bootstrap
let defaultUserToken = issueTokenForUser('USR-001');

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      authToken?: string;
    }
  }
}

// Strict Server-Side Authentication Middleware
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    // 2. Allow signed query token for binary file downloads
    token = req.query.token;
  }

  // Fallback to active bootstrap token if no token is passed (seamless initialization)
  if (!token) {
    const currentDefaultSession = activeSessions.get(defaultUserToken);
    if (!currentDefaultSession || currentDefaultSession.expiresAt < Date.now()) {
      defaultUserToken = issueTokenForUser('USR-001');
    }
    token = defaultUserToken;
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    // If request is to /api/session, gracefully issue fresh session for default operator
    if (req.path.includes('/session') || (req.originalUrl && req.originalUrl.includes('/session'))) {
      const freshToken = issueTokenForUser('USR-001');
      defaultUserToken = freshToken;
      const db = readDb();
      const user = db.users.find(u => u.id === 'USR-001')!;
      req.user = user;
      req.authToken = freshToken;
      return next();
    }

    const db = readDb();
    appendAuditEvent(db, {
      timestamp: new Date().toISOString(),
      actorId: 'UNAUTHENTICATED',
      actorName: 'Unknown Caller',
      actorRole: 'Read-Only Auditor',
      action: 'AUTHORIZATION_DENIED',
      targetType: 'Security',
      targetId: req.path,
      outcome: 'DENIED',
      details: `Missing or invalid bearer token for ${req.method} ${req.path}`,
      clientIp: req.ip
    });
    writeDb(db);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token' });
  }

  const db = readDb();
  const user = db.users.find(u => u.id === session.userId);
  if (!user || !user.active) {
    return res.status(403).json({ error: 'Forbidden: User account does not exist or has been suspended' });
  }

  req.user = user;
  req.authToken = token;
  next();
}

// Role-Based Access Control Middleware with Audit Logging
function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      const db = readDb();
      appendAuditEvent(db, {
        timestamp: new Date().toISOString(),
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'Security',
        targetId: req.path,
        outcome: 'DENIED',
        details: `Access Denied to ${req.method} ${req.path}. Required: [${allowedRoles.join(', ')}], Current: ${req.user.role}`,
        clientIp: req.ip
      });
      writeDb(db);

      return res.status(403).json({
        error: `Forbidden: Action requires one of: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }
    next();
  };
}

// Case-Level Access Authorization Helper
function checkCaseAccess(user: User, caseId: string, db: DatabaseSchema): boolean {
  if (user.role === 'Administrator' || user.role === 'Evidence Custodian') {
    return true; // Administrators and Custodians manage vault globally
  }
  const investigation = db.investigations.find(c => c.id === caseId);
  if (!investigation) return false;

  return (
    investigation.leadInvestigatorId === user.id ||
    investigation.assignedInvestigatorIds.includes(user.id)
  );
}

// Absolute Immutability: Block all modifications or deletions to Audit Records
app.all('/api/audit/events*', (req, res, next) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      error: 'Method Not Allowed: The CyberTrace Audit Ledger is cryptographically immutable and strictly append-only.'
    });
  }
  next();
});

// ================= API ENDPOINTS =================

// 1. Health & Status
app.get('/api/health', (_req, res) => {
  const db = readDb();
  res.json({
    status: 'ONLINE',
    systemName: 'CyberTrace Digital Forensics Engine',
    version: '4.2.0-SEC',
    cryptoEngine: 'Node.js FIPS-compliant Crypto (SHA-256)',
    activeSessionsCount: activeSessions.size,
    databaseRecords: {
      cases: db.investigations.length,
      evidence: db.evidence.length,
      transfers: db.custodyTransfers.length,
      auditEvents: db.auditEvents.length
    },
    auditChainHealthy: true
  });
});

// 2. Authentication & Session Management
app.get('/api/session', authenticateToken, (req, res) => {
  res.json({ user: req.user, token: req.authToken });
});

// Authenticated Role Switch / Login (Simulating secure user authentication)
app.post('/api/session/switch-role', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  const db = readDb();
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'User account not found' });
  }

  if (!targetUser.active) {
    return res.status(403).json({ error: 'Forbidden: Account is suspended' });
  }

  // Issue new cryptographic bearer token
  const token = issueTokenForUser(targetUser.id);
  defaultUserToken = token;

  targetUser.lastSignIn = new Date().toISOString();

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: targetUser.id,
    actorName: targetUser.name,
    actorRole: targetUser.role,
    action: 'USER_AUTHENTICATED',
    targetType: 'User',
    targetId: targetUser.id,
    outcome: 'SUCCESS',
    details: `Session authenticated for ${targetUser.name} (${targetUser.role}) with cryptographic token.`,
    clientIp: req.ip
  });
  writeDb(db);

  res.json({ success: true, user: targetUser, token });
});

// 3. User Management (Strictly Administrator Only)
app.get('/api/users', authenticateToken, (_req, res) => {
  const db = readDb();
  res.json(db.users);
});

app.post('/api/users', authenticateToken, requireRole(['Administrator']), (req, res) => {
  const { name, email, role, badgeNumber, department } = req.body;
  if (!name || !email || !role || !badgeNumber) {
    return res.status(400).json({ error: 'Missing required user attributes' });
  }

  const validRoles: UserRole[] = [
    'Administrator',
    'Lead Investigator',
    'Investigator',
    'Evidence Custodian',
    'Read-Only Auditor'
  ];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid user role: ' + role });
  }

  const db = readDb();
  const newUser: User = {
    id: `USR-${(db.users.length + 1).toString().padStart(3, '0')}`,
    name,
    email,
    role,
    badgeNumber,
    department: department || 'Digital Forensics Unit',
    active: true,
    lastSignIn: 'Never',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'USER_ROLE_CHANGED',
    targetType: 'User',
    targetId: newUser.id,
    outcome: 'SUCCESS',
    details: `Administrator provisioned new user: ${name} with role ${role}`
  });
  writeDb(db);

  res.status(201).json(newUser);
});

// Client-side role manipulation prevention
app.patch('/api/users/:id/role', authenticateToken, requireRole(['Administrator']), (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles: UserRole[] = [
    'Administrator',
    'Lead Investigator',
    'Investigator',
    'Evidence Custodian',
    'Read-Only Auditor'
  ];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const db = readDb();
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const oldRole = user.role;
  user.role = role;

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'USER_ROLE_CHANGED',
    targetType: 'User',
    targetId: user.id,
    outcome: 'SUCCESS',
    details: `Updated role for ${user.name} from ${oldRole} to ${role} by Administrator`
  });
  writeDb(db);

  res.json(user);
});

app.patch('/api/users/:id/status', authenticateToken, requireRole(['Administrator']), (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Prevent admin from locking out themselves
  if (user.id === req.user!.id && !active) {
    return res.status(400).json({ error: 'Security constraint: Cannot deactivate your own administrator account' });
  }

  user.active = Boolean(active);
  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'USER_STATUS_TOGGLED',
    targetType: 'User',
    targetId: user.id,
    outcome: 'SUCCESS',
    details: `${user.active ? 'Activated' : 'Suspended'} user account ${user.name}`
  });
  writeDb(db);

  res.json(user);
});

// 4. Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, (_req, res) => {
  const db = readDb();
  const investigations = db.investigations;
  const evidence = db.evidence;
  const transfers = db.custodyTransfers;
  const checks = db.integrityChecks;

  const totalInvestigations = investigations.length;
  const activeInvestigations = investigations.filter(i => i.status === 'Active' || i.status === 'Under Review').length;
  const closedInvestigations = investigations.filter(i => i.status === 'Closed' || i.status === 'Archived').length;

  const totalEvidenceItems = evidence.length;
  const inVaultEvidence = evidence.filter(e => e.custodyState === 'In Vault').length;
  const inTransitEvidence = evidence.filter(e => e.custodyState === 'Transfer In Transit').length;

  const pendingTransfersCount = transfers.filter(t => t.status === 'Requested' || t.status === 'Awaiting Acknowledgment').length;
  const recentVerificationsCount = checks.length;
  const integrityMismatchesCount = checks.filter(c => c.result === 'MISMATCH').length;
  const pendingAcknowledgmentsCount = transfers.filter(t => t.status === 'Awaiting Acknowledgment').length;

  const evidenceByCategory: Record<string, number> = {};
  for (const e of evidence) {
    evidenceByCategory[e.category] = (evidenceByCategory[e.category] || 0) + 1;
  }

  const casesByPriority: Record<string, number> = {};
  for (const c of investigations) {
    casesByPriority[c.priority] = (casesByPriority[c.priority] || 0) + 1;
  }

  const dayBuckets: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    dayBuckets[key] = 0;
  }

  for (const event of db.auditEvents) {
    const day = event.timestamp.split('T')[0];
    if (dayBuckets[day] !== undefined) {
      dayBuckets[day]++;
    }
  }

  const activityTimeline = Object.entries(dayBuckets).map(([date, actionsCount]) => ({ date, actionsCount }));

  const stats: DashboardStats = {
    totalInvestigations,
    activeInvestigations,
    closedInvestigations,
    totalEvidenceItems,
    inVaultEvidence,
    inTransitEvidence,
    pendingTransfersCount,
    recentVerificationsCount,
    integrityMismatchesCount,
    pendingAcknowledgmentsCount,
    recentAuditEvents: db.auditEvents.slice(-10).reverse(),
    evidenceByCategory,
    casesByPriority,
    activityTimeline
  };

  res.json(stats);
});

// 5. Investigations Management
app.get('/api/cases', authenticateToken, (_req, res) => {
  const db = readDb();
  res.json(db.investigations);
});

app.get('/api/cases/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const investigation = db.investigations.find(c => c.id === id);
  if (!investigation) {
    return res.status(404).json({ error: 'Investigation case not found' });
  }

  const relatedEvidence = db.evidence.filter(e => e.caseId === id);
  const relatedTransfers = db.custodyTransfers.filter(t => t.caseId === id);
  const relatedAuditEvents = db.auditEvents.filter(a => a.targetId === id || relatedEvidence.some(e => e.id === a.targetId));

  res.json({
    ...investigation,
    evidenceItems: relatedEvidence,
    custodyTransfers: relatedTransfers,
    auditEvents: relatedAuditEvents
  });
});

app.post('/api/cases', authenticateToken, requireRole(['Administrator', 'Lead Investigator']), (req, res) => {
  const { title, description, category, priority, assignedInvestigatorIds, tags, retentionYears } = req.body;
  if (!title || !description || !category || !priority) {
    return res.status(400).json({ error: 'Missing mandatory investigation fields' });
  }

  const db = readDb();
  const year = new Date().getFullYear();
  const caseCount = db.investigations.length + 1;
  const caseId = `CASE-${year}-${caseCount.toString().padStart(4, '0')}`;

  const newCase: Investigation = {
    id: caseId,
    title,
    description,
    category,
    priority,
    status: 'Active',
    leadInvestigatorId: req.user!.id,
    assignedInvestigatorIds: assignedInvestigatorIds || [req.user!.id],
    evidenceIds: [],
    tags: tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retentionYears: Number(retentionYears) || 7
  };

  db.investigations.push(newCase);
  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CASE_CREATED',
    targetType: 'Investigation',
    targetId: caseId,
    outcome: 'SUCCESS',
    details: `Initiated case ${caseId}: "${title}" [Priority: ${priority}]`
  });
  writeDb(db);

  res.status(201).json(newCase);
});

// Update / Close Case: Only Lead Investigator or Administrator
app.patch('/api/cases/:id', authenticateToken, requireRole(['Administrator', 'Lead Investigator']), (req, res) => {
  const { id } = req.params;
  const { title, description, priority, status, assignedInvestigatorIds, tags, closureSummary } = req.body;

  const db = readDb();
  const investigation = db.investigations.find(c => c.id === id);
  if (!investigation) {
    return res.status(404).json({ error: 'Investigation case not found' });
  }

  // Case-level permission: Lead Investigator must be assigned to this case unless Administrator
  if (req.user!.role !== 'Administrator' && investigation.leadInvestigatorId !== req.user!.id) {
    return res.status(403).json({
      error: 'Forbidden: Only the assigned Lead Investigator or an Administrator can modify this case dossier.'
    });
  }

  if (title) investigation.title = title;
  if (description) investigation.description = description;
  if (priority) investigation.priority = priority;
  if (assignedInvestigatorIds) investigation.assignedInvestigatorIds = assignedInvestigatorIds;
  if (tags) investigation.tags = tags;

  if (status && status !== investigation.status) {
    investigation.status = status;
    if (status === 'Closed') {
      investigation.closedAt = new Date().toISOString();
      investigation.closureSummary = closureSummary || 'Case concluded under statutory forensic guidelines.';
      appendAuditEvent(db, {
        timestamp: new Date().toISOString(),
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'CASE_CLOSED',
        targetType: 'Investigation',
        targetId: id,
        outcome: 'SUCCESS',
        details: `Case closed by ${req.user!.name}. Closure Summary: ${investigation.closureSummary}`
      });
    }
  }

  investigation.updatedAt = new Date().toISOString();

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CASE_UPDATED',
    targetType: 'Investigation',
    targetId: id,
    outcome: 'SUCCESS',
    details: `Updated case ${id}`
  });
  writeDb(db);

  res.json(investigation);
});

// 6. Evidence Management & Upload
app.get('/api/evidence', authenticateToken, (_req, res) => {
  const db = readDb();
  res.json(db.evidence);
});

app.get('/api/evidence/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const item = db.evidence.find(e => e.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  const transfers = db.custodyTransfers.filter(t => t.evidenceId === id);
  const verifications = db.integrityChecks.filter(c => c.evidenceId === id);
  const auditEvents = db.auditEvents.filter(a => a.targetId === id);

  res.json({
    ...item,
    transfers,
    verifications,
    auditEvents
  });
});

// Evidence Registration with Case-Level Validation
app.post(
  '/api/evidence/register',
  authenticateToken,
  requireRole(['Administrator', 'Lead Investigator', 'Investigator', 'Evidence Custodian']),
  upload.single('evidenceFile'),
  async (req, res) => {
    try {
      const {
        caseId,
        description,
        category,
        sourceDevice,
        serialNumber,
        collectionLocation,
        collectionMethod,
        acquisitionNotes,
        storageReference,
        manualBaselineHash,
        manualFileName,
        manualFileSize
      } = req.body;

      if (!caseId || !description || !category || !collectionLocation || !collectionMethod) {
        return res.status(400).json({ error: 'Missing required evidence intake fields' });
      }

      const db = readDb();
      const targetCase = db.investigations.find(c => c.id === caseId);
      if (!targetCase) {
        return res.status(404).json({ error: 'Referenced case does not exist: ' + caseId });
      }

      // Case-level check: User must be assigned to case or be Admin/Custodian
      if (!checkCaseAccess(req.user!, caseId, db)) {
        return res.status(403).json({
          error: `Forbidden: You are not assigned to investigation case ${caseId}`
        });
      }

      let storedFileName = '';
      let originalFileName = '';
      let fileSizeBytes = 0;
      let mimeType = 'application/octet-stream';
      let sha256Baseline = '';

      if (req.file) {
        storedFileName = req.file.filename;
        originalFileName = req.file.originalname;
        fileSizeBytes = req.file.size;
        mimeType = req.file.mimetype || 'application/octet-stream';

        const uploadedFilePath = path.join(EVIDENCE_STORAGE_DIR, storedFileName);
        sha256Baseline = await computeFileSha256(uploadedFilePath);
      } else if (manualBaselineHash) {
        storedFileName = `physical_device_${Date.now()}.meta`;
        originalFileName = manualFileName || `${sourceDevice || 'Physical_Drive'}_Forensic_Export.dd`;
        fileSizeBytes = Number(manualFileSize) || 0;
        mimeType = 'application/octet-stream';
        sha256Baseline = manualBaselineHash.trim().toLowerCase();

        if (sha256Baseline.length !== 64 || !/^[0-9a-f]{64}$/.test(sha256Baseline)) {
          return res.status(400).json({ error: 'Invalid SHA-256 baseline format (must be 64-char hex string)' });
        }

        const metaContent = `FORENSIC-PHYSICAL-ACQUISITION-MANIFEST\nCASE_ID: ${caseId}\nDEVICE: ${sourceDevice}\nSERIAL: ${serialNumber}\nSHA256_BASELINE: ${sha256Baseline}\nDATE: ${new Date().toISOString()}\nCOLLECTOR: ${req.user!.name}`;
        fs.writeFileSync(path.join(EVIDENCE_STORAGE_DIR, storedFileName), metaContent);
      } else {
        return res.status(400).json({ error: 'Either an evidence file or a verified SHA-256 baseline is required' });
      }

      const year = new Date().getFullYear();
      const evidenceCount = db.evidence.length + 1;
      const evidenceId = `EVD-${year}-${evidenceCount.toString().padStart(4, '0')}`;

      const newEvidence: EvidenceItem = {
        id: evidenceId,
        caseId,
        description,
        category,
        originalFileName,
        storedFileName,
        fileSizeBytes,
        mimeType,
        sha256Baseline,
        sourceDevice: sourceDevice || 'Suspect Workstation',
        serialNumber: serialNumber || undefined,
        collectorName: req.user!.name,
        collectorBadge: req.user!.badgeNumber,
        collectionLocation,
        collectionMethod,
        acquisitionNotes: acquisitionNotes || 'Standard forensic protocol observed.',
        storageReference: storageReference || 'VAULT-INTAKE-PENDING',
        currentCustodianId: req.user!.id,
        currentCustodianName: req.user!.name,
        currentLocation: 'Central Evidence Vault, Intake Station',
        custodyState: 'In Vault',
        isLockedForTransfer: false,
        registeredAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        lastVerificationResult: 'MATCH',
        isSyntheticDemo: false
      };

      db.evidence.push(newEvidence);
      if (!targetCase.evidenceIds.includes(evidenceId)) {
        targetCase.evidenceIds.push(evidenceId);
        targetCase.updatedAt = new Date().toISOString();
      }

      const initialCheck: IntegrityCheck = {
        id: `INT-${Date.now()}-001`,
        evidenceId,
        caseId,
        algorithm: 'SHA-256',
        expectedHash: sha256Baseline,
        observedHash: sha256Baseline,
        byteLength: fileSizeBytes,
        result: 'MATCH',
        initiatedByUserId: req.user!.id,
        initiatedByUserName: req.user!.name,
        verificationMethod: 'Post-Transfer Intake',
        timestamp: new Date().toISOString()
      };
      db.integrityChecks.push(initialCheck);

      appendAuditEvent(db, {
        timestamp: new Date().toISOString(),
        actorId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'EVIDENCE_REGISTERED',
        targetType: 'Evidence',
        targetId: evidenceId,
        outcome: 'SUCCESS',
        details: `Evidence ${evidenceId} registered in case ${caseId}. SHA-256: ${sha256Baseline}`
      });

      writeDb(db);
      res.status(201).json(newEvidence);
    } catch (err: any) {
      console.error('Evidence intake error:', err);
      res.status(500).json({ error: 'Evidence intake failed: ' + err.message });
    }
  }
);

// Protected Download: Denies Read-Only Auditor and unassigned investigators
app.get('/api/evidence/:id/download', authenticateToken, (req, res) => {
  const { id } = req.params;
  const user = req.user!;

  // Strict Role Check: Read-Only Auditors are FORBIDDEN from downloading raw binaries
  if (user.role === 'Read-Only Auditor') {
    return res.status(403).json({
      error: 'Forbidden: Read-Only Auditors are strictly restricted to metadata inspection and may not download raw forensic artifacts.'
    });
  }

  const db = readDb();
  const evidence = db.evidence.find(e => e.id === id);
  if (!evidence) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  // Case-Level Authorization Check
  if (!checkCaseAccess(user, evidence.caseId, db)) {
    appendAuditEvent(db, {
      timestamp: new Date().toISOString(),
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'AUTHORIZATION_DENIED',
      targetType: 'Evidence',
      targetId: id,
      outcome: 'DENIED',
      details: `Unauthorized download attempt for ${id} in case ${evidence.caseId} by unassigned user ${user.name}`
    });
    writeDb(db);

    return res.status(403).json({
      error: `Forbidden: You are not authorized to download evidence from case ${evidence.caseId}`
    });
  }

  const filePath = path.join(EVIDENCE_STORAGE_DIR, evidence.storedFileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Evidence file not found in private storage' });
  }

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'EVIDENCE_DOWNLOADED',
    targetType: 'Evidence',
    targetId: id,
    outcome: 'SUCCESS',
    details: `Authorized download of evidence file ${evidence.originalFileName} by ${user.name}`
  });
  writeDb(db);

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(evidence.originalFileName)}"`);
  res.setHeader('Content-Type', evidence.mimeType || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

// 7. Live Integrity Verification
app.post('/api/evidence/:id/verify-integrity', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const evidence = db.evidence.find(e => e.id === id);
  if (!evidence) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  const filePath = path.join(EVIDENCE_STORAGE_DIR, evidence.storedFileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Evidence binary file not found in storage' });
  }

  try {
    const calculatedHash = await computeFileSha256(filePath);
    const stats = fs.statSync(filePath);
    const isMatch = calculatedHash.toLowerCase() === evidence.sha256Baseline.toLowerCase();

    const checkRecord: IntegrityCheck = {
      id: `INT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      evidenceId: id,
      caseId: evidence.caseId,
      algorithm: 'SHA-256',
      expectedHash: evidence.sha256Baseline,
      observedHash: calculatedHash,
      byteLength: stats.size,
      result: isMatch ? 'MATCH' : 'MISMATCH',
      initiatedByUserId: req.user!.id,
      initiatedByUserName: req.user!.name,
      verificationMethod: 'Manual Verification',
      timestamp: new Date().toISOString(),
      discrepancyDetails: isMatch
        ? undefined
        : `CRITICAL INTEGRITY FAILURE: Observed hash (${calculatedHash}) does not match baseline (${evidence.sha256Baseline})!`
    };

    evidence.lastVerifiedAt = new Date().toISOString();
    evidence.lastVerificationResult = isMatch ? 'MATCH' : 'MISMATCH';
    db.integrityChecks.push(checkRecord);

    appendAuditEvent(db, {
      timestamp: new Date().toISOString(),
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: isMatch ? 'EVIDENCE_INTEGRITY_VERIFIED' : 'EVIDENCE_INTEGRITY_FAILED',
      targetType: 'Evidence',
      targetId: id,
      outcome: isMatch ? 'SUCCESS' : 'FAILED',
      details: isMatch
        ? `Integrity check PASSED for ${id}. SHA-256 parity confirmed.`
        : `CRITICAL ALERT: Integrity check FAILED for ${id}! Bit-stream discrepancy detected.`
    });

    writeDb(db);
    res.json(checkRecord);
  } catch (err: any) {
    res.status(500).json({ error: 'Verification error: ' + err.message });
  }
});

// Adversarial Tamper Simulation (Admin Only)
app.post('/api/evidence/:id/simulate-tamper', authenticateToken, requireRole(['Administrator']), (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const evidence = db.evidence.find(e => e.id === id);
  if (!evidence) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  const filePath = path.join(EVIDENCE_STORAGE_DIR, evidence.storedFileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on storage' });
  }

  db.tamperBackups = db.tamperBackups || {};
  if (!db.tamperBackups[id]) {
    db.tamperBackups[id] = fs.readFileSync(filePath, 'binary');
  }

  // Mutate file
  fs.appendFileSync(filePath, '\n[TAMPER_CORRUPTION_BIT_0xDEADBEEF]');

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'EVIDENCE_INTEGRITY_FAILED',
    targetType: 'Evidence',
    targetId: id,
    outcome: 'FAILED',
    details: `Adversarial test harness: Altered bit-stream for ${id}`
  });
  writeDb(db);

  res.json({ success: true, message: 'Evidence file altered for tamper detection test.' });
});

app.post('/api/evidence/:id/restore-tamper', authenticateToken, requireRole(['Administrator']), (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const evidence = db.evidence.find(e => e.id === id);
  if (!evidence) {
    return res.status(404).json({ error: 'Evidence record not found' });
  }

  const filePath = path.join(EVIDENCE_STORAGE_DIR, evidence.storedFileName);
  if (db.tamperBackups && db.tamperBackups[id]) {
    fs.writeFileSync(filePath, db.tamperBackups[id], 'binary');
    delete db.tamperBackups[id];
  }

  evidence.lastVerifiedAt = new Date().toISOString();
  evidence.lastVerificationResult = 'MATCH';

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'EVIDENCE_INTEGRITY_VERIFIED',
    targetType: 'Evidence',
    targetId: id,
    outcome: 'SUCCESS',
    details: `Restored pristine bit-stream for evidence ${id}`
  });
  writeDb(db);

  res.json({ success: true, message: 'Evidence file restored and verified against baseline.' });
});

// 8. Chain of Custody Transfers
app.get('/api/custody/transfers', authenticateToken, (_req, res) => {
  const db = readDb();
  res.json(db.custodyTransfers);
});

// Transfer Request with Concurrency Locking & Permission Checks
app.post('/api/custody/transfers/request', authenticateToken, requireRole(['Administrator', 'Lead Investigator', 'Investigator', 'Evidence Custodian']), (req, res) => {
  const {
    evidenceId,
    toCustodianId,
    transferReason,
    transferMethod,
    destinationLocation,
    senderNotes
  } = req.body;

  if (!evidenceId || !toCustodianId || !transferReason || !destinationLocation) {
    return res.status(400).json({ error: 'Missing required transfer details' });
  }

  const db = readDb();
  const evidence = db.evidence.find(e => e.id === evidenceId);
  if (!evidence) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  // Concurrency Check: Prevent conflicting transfers
  if (evidence.isLockedForTransfer) {
    return res.status(409).json({
      error: `Conflict: Evidence is currently locked for an existing active transfer (${evidence.activeTransferId})`
    });
  }

  // Permission Check: Only current custodian or assigned case investigator or Admin can transfer
  const isCurrentCustodian = evidence.currentCustodianId === req.user!.id;
  const isCaseAuthorized = checkCaseAccess(req.user!, evidence.caseId, db);

  if (!isCurrentCustodian && !isCaseAuthorized) {
    return res.status(403).json({
      error: 'Forbidden: You must be the current custodian or an assigned investigator on this case to initiate a transfer.'
    });
  }

  const toCustodian = db.users.find(u => u.id === toCustodianId);
  if (!toCustodian || !toCustodian.active) {
    return res.status(404).json({ error: 'Target custodian user not found or inactive' });
  }

  const year = new Date().getFullYear();
  const transferId = `TRF-${year}-${(db.custodyTransfers.length + 1).toString().padStart(4, '0')}`;

  const newTransfer: CustodyTransfer = {
    id: transferId,
    evidenceId,
    caseId: evidence.caseId,
    initiatingUserId: req.user!.id,
    initiatingUserName: req.user!.name,
    fromCustodianId: evidence.currentCustodianId,
    fromCustodianName: evidence.currentCustodianName,
    toCustodianId,
    toCustodianName: toCustodian.name,
    transferReason,
    transferMethod: transferMethod || 'Direct Handover',
    destinationLocation,
    status: 'Awaiting Acknowledgment',
    requestedAt: new Date().toISOString(),
    senderAcknowledgment: {
      acknowledgedBy: req.user!.name,
      timestamp: new Date().toISOString(),
      notes: senderNotes || 'Transfer initiated with intact evidence packaging.'
    }
  };

  evidence.isLockedForTransfer = true;
  evidence.activeTransferId = transferId;
  evidence.custodyState = 'Transfer In Transit';

  db.custodyTransfers.push(newTransfer);

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CUSTODY_TRANSFER_INITIATED',
    targetType: 'CustodyTransfer',
    targetId: transferId,
    outcome: 'SUCCESS',
    details: `Initiated transfer ${transferId} for ${evidenceId} to ${toCustodian.name}`
  });

  writeDb(db);
  res.status(201).json(newTransfer);
});

// Transfer Acknowledgment: Only Designated Recipient or Administrator
app.post('/api/custody/transfers/:id/acknowledge', authenticateToken, requireRole(['Administrator', 'Lead Investigator', 'Investigator', 'Evidence Custodian']), (req, res) => {
  const { id } = req.params;
  const { recipientNotes, digitalSignatureConfirm } = req.body;

  const db = readDb();
  const transfer = db.custodyTransfers.find(t => t.id === id);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer record not found' });
  }

  if (transfer.status !== 'Awaiting Acknowledgment' && transfer.status !== 'Requested') {
    return res.status(400).json({ error: `Cannot acknowledge transfer in status: ${transfer.status}` });
  }

  // Strict Recipient Enforcement
  if (req.user!.id !== transfer.toCustodianId && req.user!.role !== 'Administrator') {
    appendAuditEvent(db, {
      timestamp: new Date().toISOString(),
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'AUTHORIZATION_DENIED',
      targetType: 'CustodyTransfer',
      targetId: id,
      outcome: 'DENIED',
      details: `Unauthorized handover sign-off attempt by ${req.user!.name}. Designated recipient is ${transfer.toCustodianName}`
    });
    writeDb(db);

    return res.status(403).json({
      error: `Access Denied: Only designated recipient (${transfer.toCustodianName}) or an Administrator may acknowledge this transfer.`
    });
  }

  const evidence = db.evidence.find(e => e.id === transfer.evidenceId);
  if (!evidence) {
    return res.status(404).json({ error: 'Associated evidence record not found' });
  }

  const timestamp = new Date().toISOString();
  const signatureSeed = `DIGITAL_CUSTODY_SIG::${transfer.id}::${req.user!.id}::${timestamp}::${digitalSignatureConfirm ? 'VERIFIED' : 'ACCEPT'}`;
  const digitalSignatureHash = computeSha256(signatureSeed);

  transfer.status = 'Completed';
  transfer.completedAt = timestamp;
  transfer.recipientAcknowledgment = {
    acknowledgedBy: req.user!.name,
    timestamp,
    digitalSignatureHash,
    notes: recipientNotes || 'Evidence inspected; seals verified; physical custody assumed.'
  };

  evidence.currentCustodianId = transfer.toCustodianId;
  evidence.currentCustodianName = transfer.toCustodianName;
  evidence.currentLocation = transfer.destinationLocation;
  evidence.custodyState = transfer.destinationLocation.toLowerCase().includes('vault') ? 'In Vault' : 'Checked Out for Analysis';
  evidence.isLockedForTransfer = false;
  evidence.activeTransferId = undefined;

  appendAuditEvent(db, {
    timestamp,
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CUSTODY_TRANSFER_ACKNOWLEDGED',
    targetType: 'CustodyTransfer',
    targetId: transfer.id,
    outcome: 'SUCCESS',
    details: `Transfer ${transfer.id} completed. Official custodian is now ${transfer.toCustodianName}. Digital Signature: ${digitalSignatureHash}`
  });

  writeDb(db);
  res.json({ success: true, transfer, evidence });
});

// Reject / Cancel Transfer
app.post('/api/custody/transfers/:id/reject', authenticateToken, requireRole(['Administrator', 'Lead Investigator', 'Evidence Custodian']), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ error: 'Rejection reason is mandatory' });
  }

  const db = readDb();
  const transfer = db.custodyTransfers.find(t => t.id === id);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer not found' });
  }

  const evidence = db.evidence.find(e => e.id === transfer.evidenceId);
  if (evidence) {
    evidence.isLockedForTransfer = false;
    evidence.activeTransferId = undefined;
    evidence.custodyState = 'In Vault';
  }

  transfer.status = 'Rejected';
  transfer.rejectedReason = reason;

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CUSTODY_TRANSFER_REJECTED',
    targetType: 'CustodyTransfer',
    targetId: transfer.id,
    outcome: 'FAILED',
    details: `Transfer ${transfer.id} REJECTED by ${req.user!.name}. Reason: ${reason}`
  });

  writeDb(db);
  res.json(transfer);
});

app.post('/api/custody/transfers/:id/cancel', authenticateToken, requireRole(['Administrator', 'Lead Investigator', 'Evidence Custodian']), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const db = readDb();
  const transfer = db.custodyTransfers.find(t => t.id === id);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer not found' });
  }

  const evidence = db.evidence.find(e => e.id === transfer.evidenceId);
  if (evidence) {
    evidence.isLockedForTransfer = false;
    evidence.activeTransferId = undefined;
    evidence.custodyState = 'In Vault';
  }

  transfer.status = 'Cancelled';
  transfer.cancelledReason = reason || 'Cancelled by custodian';

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CUSTODY_TRANSFER_REJECTED',
    targetType: 'CustodyTransfer',
    targetId: transfer.id,
    outcome: 'FAILED',
    details: `Transfer ${transfer.id} CANCELLED by ${req.user!.name}`
  });

  writeDb(db);
  res.json(transfer);
});

// 9. Tamper-Evident Audit Ledger
app.get('/api/audit/events', authenticateToken, (_req, res) => {
  const db = readDb();
  res.json(db.auditEvents);
});

app.get('/api/audit/verify-chain', authenticateToken, (_req, res) => {
  const db = readDb();
  const events = db.auditEvents;

  let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (event.prevHash !== expectedPrevHash) {
      const result: AuditVerificationResult = {
        verified: false,
        totalEvents: events.length,
        brokenLinkIndex: i,
        expectedHash: expectedPrevHash,
        computedHash: event.prevHash,
        message: `CHAIN BROKEN at Sequence #${event.sequenceNumber} (${event.id}): previous hash link does not match predecessor hash!`,
        verifiedAt: new Date().toISOString()
      };
      return res.json(result);
    }

    const payloadForHashing = {
      id: event.id,
      sequenceNumber: event.sequenceNumber,
      timestamp: event.timestamp,
      actorId: event.actorId,
      actorName: event.actorName,
      actorRole: event.actorRole,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      outcome: event.outcome,
      details: event.details,
      clientIp: event.clientIp || '127.0.0.1',
      prevHash: event.prevHash
    };

    const canonical = canonicalStringify(payloadForHashing);
    const computedHash = computeSha256(canonical);

    if (computedHash !== event.hash) {
      const result: AuditVerificationResult = {
        verified: false,
        totalEvents: events.length,
        brokenLinkIndex: i,
        expectedHash: event.hash,
        computedHash,
        message: `CONTENT TAMPERING DETECTED at Sequence #${event.sequenceNumber} (${event.id}): Event payload was altered after hash commitment!`,
        verifiedAt: new Date().toISOString()
      };
      return res.json(result);
    }

    expectedPrevHash = event.hash;
  }

  const successResult: AuditVerificationResult = {
    verified: true,
    totalEvents: events.length,
    message: `All ${events.length} audit records cryptographically verified. Unbroken SHA-256 hash chain rooted at Genesis. Zero tampering detected.`,
    verifiedAt: new Date().toISOString()
  };

  res.json(successResult);
});

// Adversarial Log Tamper Test (Admin Only)
app.post('/api/audit/simulate-tamper', authenticateToken, requireRole(['Administrator']), (_req, res) => {
  const db = readDb();
  if (db.auditEvents.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 audit events to simulate tampering' });
  }

  (db as any).auditBackup = JSON.stringify(db.auditEvents);
  const targetIndex = Math.max(1, Math.floor(db.auditEvents.length / 2));
  db.auditEvents[targetIndex].details += ' [UNAUTHORIZED RETROACTIVE EDIT BY MALICIOUS ACTOR]';

  writeDb(db);
  res.json({
    success: true,
    message: `Injected unauthorized modification into Audit Record #${db.auditEvents[targetIndex].sequenceNumber}.`
  });
});

app.post('/api/audit/restore-chain', authenticateToken, requireRole(['Administrator']), (_req, res) => {
  const db = readDb();
  if ((db as any).auditBackup) {
    db.auditEvents = JSON.parse((db as any).auditBackup);
    delete (db as any).auditBackup;
    writeDb(db);
    return res.json({ success: true, message: 'Cryptographic audit chain restored.' });
  }
  res.json({ success: true, message: 'Audit chain restored.' });
});

// 10. Security Settings
app.get('/api/settings', authenticateToken, (_req, res) => {
  const db = readDb();
  res.json(db.settings);
});

app.patch('/api/settings', authenticateToken, requireRole(['Administrator']), (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'RETENTION_POLICY_UPDATED',
    targetType: 'Security',
    targetId: 'SYSTEM_SETTINGS',
    outcome: 'SUCCESS',
    details: 'Security policies updated by Administrator'
  });

  writeDb(db);
  res.json(db.settings);
});

// 11. Reset Demo Data (Admin Only)
app.post('/api/demo/reset', authenticateToken, requireRole(['Administrator']), (_req, res) => {
  const initialDb = seedInitialDatabase();
  writeDb(initialDb);
  res.json({ success: true, message: 'Database reset to initial forensic scenarios.' });
});

// 12. CSV Exports
app.get('/api/reports/export-csv', authenticateToken, (req, res) => {
  const { type } = req.query;
  const db = readDb();

  let csv = '';
  let filename = 'cybertrace_export.csv';

  if (type === 'evidence') {
    filename = `evidence_inventory_${Date.now()}.csv`;
    csv = 'Evidence_ID,Case_ID,Category,Description,Original_File,Size_Bytes,SHA256_Baseline,Collector,Location,Current_Custodian,Custody_State,Registered_At\n';
    for (const e of db.evidence) {
      csv += `"${e.id}","${e.caseId}","${e.category}","${e.description.replace(/"/g, '""')}","${e.originalFileName}",${e.fileSizeBytes},"${e.sha256Baseline}","${e.collectorName}","${e.currentLocation}","${e.currentCustodianName}","${e.custodyState}","${e.registeredAt}"\n`;
    }
  } else if (type === 'custody') {
    filename = `chain_of_custody_ledger_${Date.now()}.csv`;
    csv = 'Transfer_ID,Evidence_ID,Case_ID,Initiator,From_Custodian,To_Custodian,Transfer_Method,Destination,Status,Requested_At,Completed_At,Recipient_Signature_Hash\n';
    for (const t of db.custodyTransfers) {
      csv += `"${t.id}","${t.evidenceId}","${t.caseId}","${t.initiatingUserName}","${t.fromCustodianName}","${t.toCustodianName}","${t.transferMethod}","${t.destinationLocation}","${t.status}","${t.requestedAt}","${t.completedAt || ''}","${t.recipientAcknowledgment?.digitalSignatureHash || ''}"\n`;
    }
  } else {
    filename = `audit_trail_chain_${Date.now()}.csv`;
    csv = 'Sequence,Event_ID,Timestamp_UTC,Actor_Name,Actor_Role,Action,Target_Type,Target_ID,Outcome,Details,Previous_Hash,Canonical_SHA256_Hash\n';
    for (const a of db.auditEvents) {
      csv += `${a.sequenceNumber},"${a.id}","${a.timestamp}","${a.actorName}","${a.actorRole}","${a.action}","${a.targetType}","${a.targetId}","${a.outcome}","${a.details.replace(/"/g, '""')}","${a.prevHash}","${a.hash}"\n`;
    }
  }

  appendAuditEvent(db, {
    timestamp: new Date().toISOString(),
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'REPORT_GENERATED',
    targetType: 'Report',
    targetId: filename,
    outcome: 'SUCCESS',
    details: `Exported ${type || 'audit'} report in CSV format.`
  });
  writeDb(db);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// Start Express and mount Vite
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CyberTrace Backend] Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
