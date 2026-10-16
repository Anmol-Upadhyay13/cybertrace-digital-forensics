# CyberTrace — Advanced Digital Forensics & Chain of Custody Platform

CyberTrace is an enterprise-grade digital forensics investigation and chain of custody management platform with cryptographic SHA-256 integrity verification, verifiable audit trails, and electronic evidence tracking.

---

## 1. Core Architecture & Capabilities

- **FIPS 180-4 Cryptographic Integrity**:
  Every uploaded or registered digital artifact has its baseline SHA-256 calculated on the trusted Node.js backend. The integrity verification engine independently recalculates hashes directly from disk storage to detect bit-rot, corruption, or adversarial tampering.
- **Deterministic Chain of Custody State Machine**:
  Enforces sequential states: `Draft -> Requested -> Awaiting Acknowledgment -> Completed | Rejected | Cancelled`. Concurrency locks prevent simultaneous or conflicting custody transfers.
- **Dual-Party Custody Handover**:
  Transfers require mutual sign-off. The intended recipient executes a digital acknowledgment that binds a SHA-256 digital signature hash to the transfer record before official custody is reassigned.
- **RFC 8785 Tamper-Evident Audit Ledger**:
  Append-only sequential audit trail where each event contains `prevHash` linked to the predecessor, forming an unbroken cryptographic hash chain from Genesis. A built-in chain verification utility verifies all blocks and detects any retroactive database alterations.
- **Granular Role-Based Access Control (RBAC)**:
  Enforces least privilege across 5 roles:
  1. **Administrator**: Full system authority, user provisioning, policy management, adversarial testbed.
  2. **Lead Investigator**: Case opening, assignment, case closure, evidence registration.
  3. **Investigator**: Evidence intake, analysis checkout transfers, hash verification.
  4. **Evidence Custodian**: Vault management, physical custody receipt, transfer acknowledgments.
  5. **Read-Only Auditor**: Unrestricted audit inspection and cryptographic chain validation; write operations blocked.
- **Forensic PDF & CSV Reports**:
  Downloadable court-ready investigation dossiers, individual evidence integrity certificates, and CSV exports for evidence inventories, custody transfers, and audit logs.

---

## 2. Quick Start Guide

### Prerequisites
- Node.js 20+ installed
- npm 10+ installed

### Installation (macOS, Linux & Windows)

```bash
# 1. Install dependencies
npm install

# 2. Run automated security tests
npm test

# 3. Start full-stack development server (Express backend + Vite)
npm run dev
```

Open your browser to `http://localhost:3000`.

---

## 3. Automated Test Suite

Run the automated security and cryptographic tests:

```bash
npm test
```

The test harness verifies:
- FIPS 180-4 reference SHA-256 computation
- Single-bit avalanche effect and mismatch detection
- RFC 8785 canonical JSON order-invariance
- Tamper-evident audit hash chain integrity
- Adversarial log modification detection
- Chain of custody state machine invariants and terminal locks
- Concurrency and double-transfer prevention (409 Conflict)
- RBAC permission boundaries for all 5 roles

---

## 4. Cloud Integration & Firebase Firestore Configuration

In this environment, Cloud Firestore automated provisioning requires elevated IAM permissions on the Google Cloud project. To link an external Firebase project:

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com).
2. Enable **Firestore Database** in production mode.
3. Apply the Zero-Trust security rules below to `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false; // Default-deny catch-all
    }

    function isSignedIn() { return request.auth != null; }
    function isAdmin() { return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid)); }

    // Tamper-Evident Audit Ledger: Append-only
    match /auditEvents/{eventId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if false; // Strictly immutable
    }

    // Evidence Catalog
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

    // Investigations
    match /cases/{caseId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn();
      allow delete: if false;
    }
  }
}
```

---

## 5. Production Security Verification

- [x] Server-side SHA-256 verification (streaming Node.js crypto, no client-submitted hash trusting)
- [x] Safe random file storage names preventing directory traversal (`evd_<timestamp>_<randomHex>.bin`)
- [x] Private server storage (`./data/evidence_storage/`) with no direct public URL exposure
- [x] Session tokens persisted in `data/sessions.json` with 24-hour expiration and Bearer token verification
- [x] Case-level authorization (BOLA prevention) across evidence registration, downloads, and transfers
- [x] Read-Only Auditor role blocked from raw evidence binary downloads
- [x] Terminal custody transfer locks preventing modification or replay of completed transfers
- [x] Cryptographic hash-chained audit ledger with Genesis root and RFC 8785 canonical serialization
- [x] Dual-party custody acknowledgment with digital signature hashes
- [x] 46 automated security and E2E workflow integration tests passing (`npm run test:all`)

---

## 6. Pre-Publication Deployment Checklist & Manual Configuration

Before publishing or sharing the platform broadly with external agencies or production users, complete the following manual configuration steps:

### A. Environment & Secrets Management
1. **Never commit `.env` or raw service keys**:
   - Verify that `.env` files and `data/evidence_storage/` are in `.gitignore` (verified).
   - Configure environment variables via Cloud Run / Secret Manager in production (e.g. `PORT=3000`, `NODE_ENV=production`).
2. **Dedicated Cloud Storage Bucket**:
   - In production, transition `./data/evidence_storage/` to a private Google Cloud Storage (GCS) bucket with Uniform Bucket-Level Access enabled.
   - Deny all `allUsers` and `allAuthenticatedUsers` public access.
   - Generate short-lived signed URLs (TTL $\le 15$ minutes) on the server for authorized officer downloads.

### B. Firebase Authentication & Firestore (When Linking External GCP Project)
1. **Manual GCP IAM Permissions**:
   - Automated cloud provisioning requires the `roles/firebase.admin` or `roles/datastore.owner` IAM role on the Google Cloud project. If provisioning through AI Studio encounters permission restrictions, link the project manually using the Firebase Console.
2. **Security Rules Deployment**:
   - Deploy the hardened `firestore.rules` file in the root directory using the Firebase CLI:
     ```bash
     firebase deploy --only firestore:rules
     ```
3. **Admin User Bootstrap**:
   - Ensure the lead administrator's Firebase UID is added to `/databases/(default)/documents/admins/{uid}` in Cloud Firestore to bootstrap administrative authority.

### C. Independent Security Testing & Statutory Compliance
1. **Penetration Testing**:
   - Conduct third-party web application penetration testing on file upload limits, memory constraints, and session revocation.
2. **Judicial & Chain of Custody Protocol**:
   - Ensure agency standard operating procedures (SOPs) mandate dual-officer physical seals on physical evidence bags corresponding to the digital transfer records generated in CyberTrace.
