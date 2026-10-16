/**
 * CyberTrace End-to-End Workflow Integration Test
 * Executes real HTTP requests against the live running server to trace:
 * 1. Evidence Registration (Real file upload & SHA-256 calculation)
 * 2. Custody Transfer Initiation
 * 3. Duplicate / Conflicting Transfer Prevention (409 Conflict)
 * 4. Recipient Custody Acknowledgment & Digital Signature
 * 5. Completed Transfer Terminal Lock (Prevents retroactive edit)
 * 6. Live Re-Hashing Integrity Verification (MATCH)
 * 7. Report Generation & Download
 * 8. Full Cryptographic Hash-Chain Verification of all Audit Events
 */

const BASE_URL = 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ' - ' + detail : ''}`);
    failed++;
  }
}

async function runE2EWorkflow() {
  console.log('================================================================');
  console.log('CYBERTRACE FULL FORENSIC WORKFLOW & PERSISTENCE VERIFICATION');
  console.log('================================================================\n');

  // Step 0: Authenticate as Lead Investigator (Dr. Marcus Thorne - USR-002)
  console.log('--- Step 0: Authentication & Session Token Acquisition ---');
  const authRes = await fetch(`${BASE_URL}/session/switch-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'USR-002' })
  });
  const authData = await authRes.json();
  assert(authRes.status === 200 && !!authData.token, 'Lead Investigator authenticated with token');
  const leadToken = authData.token;

  // Step 1: Register Real Evidence Artifact
  console.log('\n--- Step 1: Evidence Intake & Server-Side SHA-256 Calculation ---');
  const testPayloadContent = `CYBERTRACE-FORENSIC-LIVE-E2E-TEST-${Date.now()}::SECTOR-RAW-DUMP`;
  const blob = new Blob([testPayloadContent], { type: 'application/octet-stream' });
  const formData = new FormData();
  formData.append('caseId', 'CASE-2026-0104');
  formData.append('description', 'Live memory acquisition sector dump from suspect workstation WS-09');
  formData.append('category', 'Forensic Memory Dump');
  formData.append('sourceDevice', 'Dell Precision Workstation WS-09');
  formData.append('serialNumber', 'SN-DELL-882049');
  formData.append('collectionLocation', 'Incident Site A, Forensic Field Unit');
  formData.append('collectionMethod', 'Live Memory Acquisition');
  formData.append('acquisitionNotes', 'Captured via hardware write-blocked USB bridge.');
  formData.append('storageReference', 'VAULT-INTAKE-LOCKER-04');
  formData.append('evidenceFile', blob, 'ws09_memory_sector.raw');

  const intakeRes = await fetch(`${BASE_URL}/evidence/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${leadToken}` },
    body: formData
  });

  const intakeData = await intakeRes.json();
  assert(intakeRes.status === 201 && !!intakeData.id, `Evidence registered successfully: ${intakeData.id}`);
  assert(intakeData.sha256Baseline.length === 64, 'Server calculated 64-character SHA-256 baseline hash');
  assert(intakeData.custodyState === 'In Vault', 'Initial custody state is "In Vault"');
  assert(intakeData.currentCustodianId === 'USR-002', 'Initial official custodian is Lead Investigator');

  const registeredEvidenceId = intakeData.id;

  // Step 2: Custody Transfer Initiation
  console.log('\n--- Step 2: Custody Transfer Initiation (Lead -> Vault Custodian) ---');
  const transferRes = await fetch(`${BASE_URL}/custody/transfers/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${leadToken}`
    },
    body: JSON.stringify({
      evidenceId: registeredEvidenceId,
      toCustodianId: 'USR-004', // Officer David Kim (Evidence Custodian)
      transferReason: 'Secure long-term custody deposit into Central Evidence Vault Zone Alpha',
      transferMethod: 'Direct Handover',
      destinationLocation: 'Central Evidence Vault, Shelf 3-B',
      senderNotes: 'Seals #DFIR-7701 intact and inspected.'
    })
  });

  const transferData = await transferRes.json();
  assert(transferRes.status === 201 && !!transferData.id, `Transfer request initiated: ${transferData.id}`);
  assert(transferData.status === 'Awaiting Acknowledgment', 'Transfer state is "Awaiting Acknowledgment"');

  const transferId = transferData.id;

  // Verify Evidence is now locked
  const evidenceCheckRes = await fetch(`${BASE_URL}/evidence/${registeredEvidenceId}`, {
    headers: { Authorization: `Bearer ${leadToken}` }
  });
  const evidenceCheckData = await evidenceCheckRes.json();
  assert(evidenceCheckData.isLockedForTransfer === true, 'Evidence artifact is locked for active transfer');
  assert(evidenceCheckData.custodyState === 'Transfer In Transit', 'Custody state changed to "Transfer In Transit"');

  // Step 3: Duplicate Transfer Request Prevention (Concurrency Test)
  console.log('\n--- Step 3: Duplicate Transfer Request Prevention (Concurrency Protection) ---');
  const duplicateTransferRes = await fetch(`${BASE_URL}/custody/transfers/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${leadToken}`
    },
    body: JSON.stringify({
      evidenceId: registeredEvidenceId,
      toCustodianId: 'USR-003',
      transferReason: 'Conflicting simultaneous transfer attempt',
      transferMethod: 'Direct Handover',
      destinationLocation: 'Lab Station 1'
    })
  });

  assert(duplicateTransferRes.status === 409, 'Duplicate transfer request rejected with 409 Conflict');

  // Step 4: Recipient Custody Acknowledgment
  console.log('\n--- Step 4: Recipient Custody Acknowledgment & Digital Signature ---');
  // Authenticate as intended recipient: Officer David Kim (USR-004)
  const custodianAuthRes = await fetch(`${BASE_URL}/session/switch-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'USR-004' })
  });
  const custodianAuthData = await custodianAuthRes.json();
  const custodianToken = custodianAuthData.token;

  // Acknowledge transfer
  const ackRes = await fetch(`${BASE_URL}/custody/transfers/${transferId}/acknowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custodianToken}`
    },
    body: JSON.stringify({
      recipientNotes: 'Vault intake verified; physical seals intact; secured in vault locker 14.',
      digitalSignatureConfirm: true
    })
  });

  const ackData = await ackRes.json();
  assert(ackRes.status === 200 && ackData.success === true, 'Custody transfer acknowledged and completed');
  assert(ackData.transfer.status === 'Completed', 'Transfer status transitioned to "Completed"');
  assert(!!ackData.transfer.recipientAcknowledgment.digitalSignatureHash, 'Digital signature hash generated on acknowledgment');

  // Verify official evidence custody has updated
  assert(ackData.evidence.currentCustodianId === 'USR-004', 'Official custodian reassigned to Officer David Kim (USR-004)');
  assert(ackData.evidence.isLockedForTransfer === false, 'Evidence transfer lock released');
  assert(ackData.evidence.currentLocation === 'Central Evidence Vault, Shelf 3-B', 'Evidence location updated');

  // Step 5: Completed Transfer Terminal Lock
  console.log('\n--- Step 5: Completed Transfer Terminal Lock (Prevents Silent Alterations) ---');
  const replayAckRes = await fetch(`${BASE_URL}/custody/transfers/${transferId}/acknowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custodianToken}`
    },
    body: JSON.stringify({
      recipientNotes: 'Malicious re-acknowledgment attempt',
      digitalSignatureConfirm: true
    })
  });

  assert(replayAckRes.status === 400, 'Re-acknowledgment or modification of Completed transfer blocked with 400 Bad Request');

  // Step 6: Live Integrity Verification
  console.log('\n--- Step 6: Live Server-Side Integrity Verification ---');
  const verifyRes = await fetch(`${BASE_URL}/evidence/${registeredEvidenceId}/verify-integrity`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custodianToken}` }
  });

  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, 'Integrity verification endpoint executed successfully');
  assert(verifyData.result === 'MATCH', 'Cryptographic verification returned MATCH against baseline');
  assert(verifyData.observedHash === intakeData.sha256Baseline, 'Live observed file hash is identical to intake baseline');

  // Step 7: Report Generation
  console.log('\n--- Step 7: Report Generation & CSV Export ---');
  const reportRes = await fetch(`${BASE_URL}/reports/export-csv?type=evidence`, {
    headers: { Authorization: `Bearer ${custodianToken}` }
  });

  assert(reportRes.status === 200, 'Evidence inventory CSV report generated successfully (200 OK)');
  const csvContent = await reportRes.text();
  assert(csvContent.includes(registeredEvidenceId), 'Generated CSV report contains newly registered evidence artifact');

  // Step 8: Full Cryptographic Audit Chain Verification
  console.log('\n--- Step 8: Full Cryptographic Audit Hash-Chain Verification ---');
  const chainRes = await fetch(`${BASE_URL}/audit/verify-chain`, {
    headers: { Authorization: `Bearer ${custodianToken}` }
  });

  const chainData = await chainRes.json();
  assert(chainRes.status === 200, 'Chain verification executed successfully');
  assert(chainData.verified === true, 'All audit events (intake, transfer, sign-off, verify, report) form an unbroken SHA-256 chain');

  // Final Summary
  console.log('\n================================================================');
  console.log(`WORKFLOW TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2EWorkflow().catch(err => {
  console.error('E2E Workflow Test Failed:', err);
  process.exit(1);
});
