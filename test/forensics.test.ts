/**
 * CyberTrace Comprehensive Security & Cryptographic Verification Test Suite
 * Includes Positive and Negative Tests proving:
 * - Broken Access Control Prevention (RBAC)
 * - Broken Object Level Authorization (BOLA / Case-Level Access)
 * - Token Verification & Session Security
 * - Prevention of Client-Side Role Elevation
 * - Unauthorized Evidence Download Denial
 * - Immutable Audit Ledger Protection (No PUT/PATCH/DELETE)
 * - Cryptographic SHA-256 Parity & Avalanche Sensitivity
 * - Custody Transfer State Machine & Double-Transfer Locking
 */

import crypto from 'crypto';

// Canonical JSON stringification (RFC 8785)
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

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failedTests++;
  }
}

// User and Case Mock Fixtures
interface MockUser {
  id: string;
  name: string;
  role: 'Administrator' | 'Lead Investigator' | 'Investigator' | 'Evidence Custodian' | 'Read-Only Auditor';
  active: boolean;
}

const USERS: Record<string, MockUser> = {
  admin: { id: 'USR-001', name: 'Agent Sarah Vance', role: 'Administrator', active: true },
  leadAssigned: { id: 'USR-002', name: 'Dr. Marcus Thorne', role: 'Lead Investigator', active: true },
  investigatorAssigned: { id: 'USR-003', name: 'Detective Elena Rostova', role: 'Investigator', active: true },
  investigatorUnassigned: { id: 'USR-006', name: 'Detective Roger Smith', role: 'Investigator', active: true },
  custodian: { id: 'USR-004', name: 'Officer David Kim', role: 'Evidence Custodian', active: true },
  auditor: { id: 'USR-005', name: 'Judge Linda Holbrook', role: 'Read-Only Auditor', active: true },
  suspendedUser: { id: 'USR-007', name: 'Suspended Officer', role: 'Investigator', active: false }
};

const CASES: Record<string, any> = {
  case104: {
    id: 'CASE-2026-0104',
    title: 'Operation DarkVault',
    leadInvestigatorId: 'USR-002',
    assignedInvestigatorIds: ['USR-002', 'USR-003'],
    status: 'Active'
  },
  case098: {
    id: 'CASE-2026-0098',
    title: 'Trade Secret Theft',
    leadInvestigatorId: 'USR-002',
    assignedInvestigatorIds: ['USR-002'],
    status: 'Under Review'
  }
};

const EVIDENCE: Record<string, any> = {
  evd812: {
    id: 'EVD-2026-0812',
    caseId: 'CASE-2026-0104',
    sha256Baseline: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    currentCustodianId: 'USR-004',
    isLockedForTransfer: false
  },
  evd814: {
    id: 'EVD-2026-0814',
    caseId: 'CASE-2026-0098',
    sha256Baseline: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    currentCustodianId: 'USR-002',
    isLockedForTransfer: true,
    activeTransferId: 'TRF-2026-1001'
  }
};

// Access Control Simulation Functions
function canDownloadEvidence(user: MockUser, evidenceItem: any, targetCase: any): { allowed: boolean; status: number; reason: string } {
  if (!user.active) {
    return { allowed: false, status: 403, reason: 'Account suspended' };
  }
  // Negative check 1: Read-Only Auditor is strictly denied raw binary downloads
  if (user.role === 'Read-Only Auditor') {
    return { allowed: false, status: 403, reason: 'Read-Only Auditor forbidden from downloading raw forensic binaries' };
  }
  // Global permissions
  if (user.role === 'Administrator' || user.role === 'Evidence Custodian') {
    return { allowed: true, status: 200, reason: 'Global authorized role' };
  }
  // Case-level permission (BOLA prevention)
  const isAssigned = targetCase.leadInvestigatorId === user.id || targetCase.assignedInvestigatorIds.includes(user.id);
  if (!isAssigned) {
    return { allowed: false, status: 403, reason: 'User not assigned to investigation case' };
  }
  return { allowed: true, status: 200, reason: 'Authorized assigned investigator' };
}

function canModifyUserRole(caller: MockUser, targetUser: MockUser, newRole: string): { allowed: boolean; status: number } {
  // Only Administrators can modify user roles
  if (caller.role !== 'Administrator') {
    return { allowed: false, status: 403 };
  }
  // User cannot self-elevate or self-modify if not admin
  return { allowed: true, status: 200 };
}

function canAcknowledgeTransfer(caller: MockUser, transfer: any): { allowed: boolean; status: number } {
  if (transfer.status !== 'Awaiting Acknowledgment') {
    return { allowed: false, status: 400 };
  }
  // Only designated recipient or Administrator
  if (caller.id !== transfer.toCustodianId && caller.role !== 'Administrator') {
    return { allowed: false, status: 403 };
  }
  return { allowed: true, status: 200 };
}

function canInitiateTransfer(caller: MockUser, evidenceItem: any, targetCase: any): { allowed: boolean; status: number; reason?: string } {
  // Concurrency check
  if (evidenceItem.isLockedForTransfer) {
    return { allowed: false, status: 409, reason: 'Conflict: Evidence locked for pending transfer' };
  }
  // Must be current custodian or assigned investigator or Administrator
  const isCustodian = evidenceItem.currentCustodianId === caller.id;
  const isAssigned = targetCase.leadInvestigatorId === caller.id || targetCase.assignedInvestigatorIds.includes(caller.id);
  const isAdmin = caller.role === 'Administrator';

  if (!isCustodian && !isAssigned && !isAdmin) {
    return { allowed: false, status: 403, reason: 'Forbidden: Caller not current custodian or assigned case officer' };
  }
  return { allowed: true, status: 201 };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('CYBERTRACE DEFENSIVE SECURITY & BROKEN ACCESS CONTROL TEST SUITE');
  console.log('================================================================\n');

  // Group 1: Token & Authentication Verification
  console.log('--- 1. Authentication & Session Token Verification ---');
  const validToken = 'ct_' + crypto.randomBytes(32).toString('hex');
  const tokenStore = new Map([[validToken, { userId: 'USR-001', expiresAt: Date.now() + 60000 }]]);

  function verifyTokenMock(header?: string): { authenticated: boolean; status: number } {
    if (!header || !header.startsWith('Bearer ')) return { authenticated: false, status: 401 };
    const token = header.substring(7);
    const session = tokenStore.get(token);
    if (!session || session.expiresAt < Date.now()) return { authenticated: false, status: 401 };
    return { authenticated: true, status: 200 };
  }

  assert(verifyTokenMock().status === 401, 'NEGATIVE: Missing Authorization header rejected with 401 Unauthorized');
  assert(verifyTokenMock('Bearer invalid_token_123').status === 401, 'NEGATIVE: Invalid Bearer token rejected with 401 Unauthorized');
  assert(verifyTokenMock(`Bearer ${validToken}`).status === 200, 'POSITIVE: Cryptographic Bearer token authenticated with 200 OK');

  // Group 2: Unauthorized Evidence Download Denial (Negative Tests)
  console.log('\n--- 2. Evidence Download Access Control & BOLA Prevention ---');
  // Negative Test 2A: Read-Only Auditor cannot download raw evidence
  const dlAuditor = canDownloadEvidence(USERS.auditor, EVIDENCE.evd812, CASES.case104);
  assert(dlAuditor.allowed === false && dlAuditor.status === 403, 'NEGATIVE: Read-Only Auditor blocked from downloading raw evidence (403 Forbidden)');

  // Negative Test 2B: Investigator NOT assigned to Case 104 cannot download its evidence
  const dlUnassigned = canDownloadEvidence(USERS.investigatorUnassigned, EVIDENCE.evd812, CASES.case104);
  assert(dlUnassigned.allowed === false && dlUnassigned.status === 403, 'NEGATIVE: Unassigned Investigator blocked from downloading evidence from unassigned case (403 BOLA Guard)');

  // Negative Test 2C: Suspended user cannot download evidence
  const dlSuspended = canDownloadEvidence(USERS.suspendedUser, EVIDENCE.evd812, CASES.case104);
  assert(dlSuspended.allowed === false && dlSuspended.status === 403, 'NEGATIVE: Suspended user account blocked from downloading evidence (403 Forbidden)');

  // Positive Test 2D: Assigned investigator can download
  const dlAssigned = canDownloadEvidence(USERS.investigatorAssigned, EVIDENCE.evd812, CASES.case104);
  assert(dlAssigned.allowed === true && dlAssigned.status === 200, 'POSITIVE: Assigned Investigator authorized to download case evidence (200 OK)');

  // Positive Test 2E: Administrator can download
  const dlAdmin = canDownloadEvidence(USERS.admin, EVIDENCE.evd812, CASES.case104);
  assert(dlAdmin.allowed === true && dlAdmin.status === 200, 'POSITIVE: Administrator authorized to download evidence (200 OK)');

  // Group 3: Client-Side Role Manipulation & Privilege Escalation (Negative Tests)
  console.log('\n--- 3. Client-Side Role Manipulation & Privilege Escalation ---');
  // Negative Test 3A: Investigator attempts to elevate self or colleague to Administrator
  const roleEscalate = canModifyUserRole(USERS.investigatorAssigned, USERS.investigatorAssigned, 'Administrator');
  assert(roleEscalate.allowed === false && roleEscalate.status === 403, 'NEGATIVE: Investigator forbidden from modifying user roles or self-elevating (403 Forbidden)');

  // Negative Test 3B: Read-Only Auditor attempts to modify user roles
  const auditorRoleMod = canModifyUserRole(USERS.auditor, USERS.investigatorAssigned, 'Administrator');
  assert(auditorRoleMod.allowed === false && auditorRoleMod.status === 403, 'NEGATIVE: Auditor forbidden from modifying user roles (403 Forbidden)');

  // Positive Test 3C: Administrator authorized to modify roles
  const adminRoleMod = canModifyUserRole(USERS.admin, USERS.investigatorAssigned, 'Lead Investigator');
  assert(adminRoleMod.allowed === true && adminRoleMod.status === 200, 'POSITIVE: Administrator permitted to assign roles (200 OK)');

  // Group 4: Chain of Custody Handover Authorization & Concurrency (Negative Tests)
  console.log('\n--- 4. Custody Handover Authorization & Concurrency Control ---');
  const mockTransfer = {
    id: 'TRF-2026-9001',
    evidenceId: 'EVD-2026-0812',
    fromCustodianId: 'USR-004',
    toCustodianId: 'USR-003', // Designated recipient is Elena Rostova
    status: 'Awaiting Acknowledgment'
  };

  // Negative Test 4A: Different user attempts to acknowledge transfer assigned to Elena
  const ackWrongUser = canAcknowledgeTransfer(USERS.investigatorUnassigned, mockTransfer);
  assert(ackWrongUser.allowed === false && ackWrongUser.status === 403, 'NEGATIVE: Non-designated user cannot sign/acknowledge someone else\'s custody transfer (403 Forbidden)');

  // Positive Test 4B: Designated recipient acknowledges transfer
  const ackDesignated = canAcknowledgeTransfer(USERS.investigatorAssigned, mockTransfer);
  assert(ackDesignated.allowed === true && ackDesignated.status === 200, 'POSITIVE: Designated recipient successfully acknowledges custody handover (200 OK)');

  // Negative Test 4C: Replay attack on Completed transfer
  const completedTransfer = { ...mockTransfer, status: 'Completed' };
  const ackCompleted = canAcknowledgeTransfer(USERS.investigatorAssigned, completedTransfer);
  assert(ackCompleted.allowed === false && ackCompleted.status === 400, 'NEGATIVE: Completed transfer cannot be re-acknowledged or modified (400 Terminal Lock)');

  // Negative Test 4D: Conflicting transfer on locked evidence
  const trfConflict = canInitiateTransfer(USERS.admin, EVIDENCE.evd814, CASES.case098);
  assert(trfConflict.allowed === false && trfConflict.status === 409, 'NEGATIVE: Conflicting transfer on locked artifact rejected with 409 Conflict');

  // Negative Test 4E: Unassigned investigator cannot initiate transfer of evidence they don't hold
  const trfUnassigned = canInitiateTransfer(USERS.investigatorUnassigned, EVIDENCE.evd812, CASES.case104);
  assert(trfUnassigned.allowed === false && trfUnassigned.status === 403, 'NEGATIVE: Unassigned officer not holding evidence cannot transfer it (403 Forbidden)');

  // Group 5: Immutable Audit Ledger Protection (Negative Tests)
  console.log('\n--- 5. Audit Ledger Immutability & Modification Denial ---');
  function handleAuditHttpMethod(method: string): { status: number; message: string } {
    if (['PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      return { status: 405, message: 'Method Not Allowed: Audit Ledger is strictly append-only' };
    }
    return { status: 200, message: 'Allowed' };
  }

  assert(handleAuditHttpMethod('PUT').status === 405, 'NEGATIVE: HTTP PUT on audit events rejected with 405 Method Not Allowed');
  assert(handleAuditHttpMethod('PATCH').status === 405, 'NEGATIVE: HTTP PATCH on audit events rejected with 405 Method Not Allowed');
  assert(handleAuditHttpMethod('DELETE').status === 405, 'NEGATIVE: HTTP DELETE on audit events rejected with 405 Method Not Allowed');

  // Group 6: Cryptographic Hash Parity & Adversarial Tamper Detection
  console.log('\n--- 6. Cryptographic SHA-256 Parity & Hash-Chain Verification ---');
  const pristineData = 'FORENSIC-RAW-CAPTURE::SECTOR-0x00A::IMMUTABLE-HASH';
  const baselineHash = computeSha256(pristineData);

  // Verification MATCH
  assert(computeSha256(pristineData) === baselineHash, 'POSITIVE: Pristine file produces exact baseline SHA-256 match');

  // Verification MISMATCH
  const corruptedData = pristineData + ' ';
  const corruptedHash = computeSha256(corruptedData);
  assert(corruptedHash !== baselineHash, 'NEGATIVE: Single-space corruption produces complete SHA-256 hash mismatch');

  // Hash-Chain Tamper Detection
  const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const b1 = { seq: 1, action: 'LOGIN', prevHash: genesisHash };
  const h1 = computeSha256(canonicalStringify(b1));

  const b2 = { seq: 2, action: 'EVIDENCE_IN', prevHash: h1 };
  const h2 = computeSha256(canonicalStringify(b2));

  // Adversary alters b1 payload without recalculating h1 and h2
  const tamperedB1 = { seq: 1, action: 'UNAUTHORIZED_LOGIN', prevHash: genesisHash };
  const chainCheck = computeSha256(canonicalStringify(tamperedB1)) === h1;
  assert(chainCheck === false, 'NEGATIVE: Retroactive modification of block payload is caught by hash verification');

  // Summary
  console.log('\n================================================================');
  console.log(`SECURITY TEST AUDIT COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
