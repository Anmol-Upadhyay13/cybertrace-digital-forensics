import { jsPDF } from 'jspdf';
import { Investigation, EvidenceItem, CustodyTransfer, IntegrityCheck, User } from '../types/forensics';

export function generateInvestigationPdfReport(
  investigation: Investigation,
  evidence: EvidenceItem[],
  transfers: CustodyTransfer[],
  currentUser: User
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(6, 182, 212); // cyan-500
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CYBERTRACE FORENSICS', 14, 12);

  doc.setTextColor(203, 213, 225); // slate-300
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('DIGITAL EVIDENCE & CHAIN OF CUSTODY REPORT', 14, 18);
  doc.text(`CONFIDENTIAL // LAW ENFORCEMENT & REGULATORY USE ONLY`, 14, 23);

  // Top Right Info
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`REPORT ID: RPT-${Date.now().toString().slice(-8)}`, pageWidth - 65, 12);
  doc.text(`DATE (UTC): ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`, pageWidth - 65, 17);
  doc.text(`OPERATOR: ${currentUser.name}`, pageWidth - 65, 22);

  y = 38;

  // Case Overview Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, pageWidth - 28, 38, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`CASE FILE: ${investigation.id}`, 18, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Title: ${investigation.title}`, 18, y + 15);
  doc.text(`Category: ${investigation.category}  |  Priority: ${investigation.priority}  |  Status: ${investigation.status}`, 18, y + 21);
  doc.text(`Opened: ${new Date(investigation.createdAt).toUTCString()}  |  Retention: ${investigation.retentionYears} Years`, 18, y + 27);
  doc.text(`Lead Officer: ${currentUser.name} (${currentUser.badgeNumber})`, 18, y + 33);

  y += 46;

  // Evidence Items Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`1. REGISTERED DIGITAL EVIDENCE ARTIFACTS (${evidence.length} ITEMS)`, 14, y);
  y += 6;

  if (evidence.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('No digital evidence recorded for this case.', 18, y);
    y += 10;
  } else {
    for (const item of evidence) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);
      doc.rect(14, y, pageWidth - 28, 28, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${item.id} — ${item.originalFileName} (${(item.fileSizeBytes / 1024).toFixed(1)} KB)`, 18, y + 6);

      doc.setFontSize(7.5);
      doc.setFont('courier', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`SHA-256 BASELINE: ${item.sha256Baseline}`, 18, y + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Category: ${item.category} | Method: ${item.collectionMethod} | State: ${item.custodyState}`, 18, y + 18);
      doc.text(`Custodian: ${item.currentCustodianName} | Location: ${item.currentLocation}`, 18, y + 23);

      y += 32;
    }
  }

  y += 4;

  // Chain of Custody Chronology
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`2. CHRONOLOGICAL CHAIN OF CUSTODY LOG (${transfers.length} TRANSFERS)`, 14, y);
  y += 6;

  if (transfers.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('No custody transfers recorded. Evidence remains in intake vault.', 18, y);
    y += 10;
  } else {
    for (const t of transfers) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(226, 232, 240);
      doc.rect(14, y, pageWidth - 28, 22, 'S');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${t.id} [${t.status.toUpperCase()}] — Evidence: ${t.evidenceId}`, 18, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`From: ${t.fromCustodianName}  -->  To: ${t.toCustodianName} (${t.destinationLocation})`, 18, y + 10);
      doc.text(`Reason: ${t.transferReason} | Method: ${t.transferMethod}`, 18, y + 15);
      if (t.recipientAcknowledgment) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.text(`Ack Hash: ${t.recipientAcknowledgment.digitalSignatureHash.slice(0, 36)}...`, 18, y + 19);
      }

      y += 26;
    }
  }

  // Footer Disclaimer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'LEGAL DISCLAIMER: Cryptographic SHA-256 hashes demonstrate bit-stream consistency with recorded intake baseline. Does not attest to lawful collection or physical security independent of authenticated custody logs.',
      14,
      doc.internal.pageSize.getHeight() - 10,
      { maxWidth: pageWidth - 28 }
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 24, doc.internal.pageSize.getHeight() - 5);
  }

  doc.save(`CyberTrace_Investigation_${investigation.id}_Report.pdf`);
}

export function generateEvidenceIntegrityPdf(
  evidence: EvidenceItem,
  verifications: IntegrityCheck[],
  currentUser: User
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(6, 182, 212);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CYBERTRACE INTEGRITY CERTIFICATE', 14, 12);

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('CRYPTOGRAPHIC BIT-STREAM VERIFICATION AUDIT', 14, 18);
  doc.text(`TARGET ARTIFACT: ${evidence.id}`, 14, 23);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`CERT ID: INT-${Date.now().toString().slice(-8)}`, pageWidth - 60, 12);
  doc.text(`DATE (UTC): ${new Date().toISOString().slice(0, 10)}`, pageWidth - 60, 17);
  doc.text(`AUDITOR: ${currentUser.name}`, pageWidth - 60, 22);

  y = 38;

  // Evidence Details Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, pageWidth - 28, 44, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`EVIDENCE METADATA: ${evidence.id}`, 18, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`File Name: ${evidence.originalFileName}`, 18, y + 15);
  doc.text(`Size: ${evidence.fileSizeBytes} bytes (${(evidence.fileSizeBytes / 1024).toFixed(2)} KB)`, 18, y + 20);
  doc.text(`Category: ${evidence.category} | Source: ${evidence.sourceDevice}`, 18, y + 25);
  doc.text(`Collector: ${evidence.collectorName} (Badge ${evidence.collectorBadge})`, 18, y + 30);
  doc.text(`Registration Timestamp: ${evidence.registeredAt}`, 18, y + 35);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(`BASELINE SHA-256: ${evidence.sha256Baseline}`, 18, y + 41);

  y += 52;

  // Verification Log
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`CRYPTOGRAPHIC INTEGRITY VERIFICATION LOG (${verifications.length} CHECKS)`, 14, y);
  y += 8;

  for (const check of verifications) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    const isMatch = check.result === 'MATCH';
    doc.setDrawColor(isMatch ? 34 : 220, isMatch ? 197 : 38, isMatch ? 94 : 38);
    doc.rect(14, y, pageWidth - 28, 24, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isMatch ? 22 : 185, isMatch ? 101 : 28, isMatch ? 52 : 28);
    doc.text(`[${check.result}] Check ID: ${check.id} — Method: ${check.verificationMethod}`, 18, y + 6);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Observed Hash: ${check.observedHash}`, 18, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Timestamp: ${check.timestamp} | Verified by: ${check.initiatedByUserName}`, 18, y + 18);

    y += 28;
  }

  // Footer Disclaimer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'FIPS 180-4 COMPLIANT CRYPTOGRAPHIC INTEGRITY AUDIT. Generated by CyberTrace Digital Forensics Engine.',
    14,
    doc.internal.pageSize.getHeight() - 8
  );

  doc.save(`CyberTrace_Integrity_Cert_${evidence.id}.pdf`);
}
