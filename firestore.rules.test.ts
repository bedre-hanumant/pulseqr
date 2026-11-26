/**
 * Firestore Security Rules Verification Suite (Phase 0 Security TDD)
 * Verifies all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 *
 * Run against Firebase Emulator Suite:
 *   npx firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'create' | 'update' | 'get' | 'list';
  actor: {
    uid: string | null;
    email?: string;
    email_verified?: boolean;
  };
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedRulePillar: string;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on QR Create',
    collection: 'qrcodes',
    docId: 'qr_spoof_001',
    operation: 'create',
    actor: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      qrId: 'qr_spoof_001',
      owner: 'victim_uid',
      title: 'Spoofed QR',
      shortSlug: 'spoof1',
      originalLink: 'https://example.com',
      currentLink: 'https://example.com',
      qrImage: '',
      qrType: 'website',
      scanCount: 0,
      status: 'active',
      customColor: '#0F172A',
      bgColor: '#FFFFFF',
      logo: '',
      expiryDate: '',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Pillar 2: Identity Integrity (data.owner == request.auth.uid)',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin Privilege Escalation',
    collection: 'users',
    docId: 'attacker_uid',
    operation: 'create',
    actor: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'attacker_uid',
      name: 'Attacker',
      email: 'attacker@example.com',
      photoURL: '',
      role: 'admin',
      plan: 'enterprise',
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Pillar 4: Prevent Self-Assigned Roles (role must be user)',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on QR Create',
    collection: 'qrcodes',
    docId: 'qr_shadow_003',
    operation: 'create',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      qrId: 'qr_shadow_003',
      owner: 'user_a',
      title: 'Shadow QR',
      shortSlug: 'shadow3',
      originalLink: 'https://example.com',
      currentLink: 'https://example.com',
      qrImage: '',
      qrType: 'website',
      scanCount: 0,
      status: 'active',
      customColor: '#0F172A',
      bgColor: '#FFFFFF',
      logo: '',
      expiryDate: '',
      isVerifiedOverride: true,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Pillar 2: Strict hasOnly() Key Blueprint',
  },
  {
    id: 4,
    name: 'PII Cross-User Profile Read',
    collection: 'users',
    docId: 'victim_uid',
    operation: 'get',
    actor: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Pillar 6: PII Isolation (isOwner || isAdmin)',
  },
  {
    id: 5,
    name: 'Unscoped QR List Scraping',
    collection: 'qrcodes',
    docId: '*',
    operation: 'list',
    actor: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Pillar 8: Secure List Queries (resource.data.owner == request.auth.uid)',
  },
  {
    id: 6,
    name: 'Email Spoofing Admin Bypass (Unverified Email)',
    collection: 'users',
    docId: '*',
    operation: 'list',
    actor: { uid: 'spoof_admin', email: 'bedrehanumant8@gmail.com', email_verified: false },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Phase 5: Email Verification Gate on Admin Check',
  },
  {
    id: 7,
    name: 'Backdated Timestamp Forgery',
    collection: 'qrcodes',
    docId: 'qr_time_007',
    operation: 'create',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      qrId: 'qr_time_007',
      owner: 'user_a',
      title: 'Backdated',
      shortSlug: 'time07',
      originalLink: 'https://example.com',
      currentLink: 'https://example.com',
      qrImage: '',
      qrType: 'website',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
      scanCount: 0,
      status: 'active',
      customColor: '#0F172A',
      bgColor: '#FFFFFF',
      logo: '',
      expiryDate: '',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Temporal Integrity (createdAt == request.time)',
  },
  {
    id: 8,
    name: 'Non-Atomic Scan Fabrication',
    collection: 'scans',
    docId: 'scan_fake_008',
    operation: 'create',
    actor: { uid: null },
    payload: {
      scanId: 'scan_fake_008',
      qrId: 'qr_valid_001',
      qrOwner: 'user_a',
      qrTitle: 'Promo',
      qrType: 'website',
      deviceType: 'Mobile',
      browser: 'Chrome',
      os: 'Android',
      country: 'US',
      city: 'Austin',
      referrer: '',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Pillar 7: Atomicity Guarantee (getAfter scanCount == scanCount + 1)',
  },
  {
    id: 9,
    name: 'Scan Count Inflation (+500)',
    collection: 'qrcodes',
    docId: 'qr_valid_001',
    operation: 'update',
    actor: { uid: null },
    payload: {
      scanCount: 500,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Action-Based Update (scanCount == existing.scanCount + 1)',
  },
  {
    id: 10,
    name: 'Terminal Archived State Mutation',
    collection: 'qrcodes',
    docId: 'qr_archived_010',
    operation: 'update',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      currentLink: 'https://hijacked.example.com',
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Terminal State Locking (existing.status != archived)',
  },
  {
    id: 11,
    name: 'Value Poisoning on Allowed Update Field',
    collection: 'qrcodes',
    docId: 'qr_valid_001',
    operation: 'update',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      customColor: 'not-a-hex-color-poison-payload',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Pillar 2: isValidQRCode() wraps entire allow update',
  },
  {
    id: 12,
    name: 'Path Variable ID Poisoning',
    collection: 'qrcodes',
    docId: 'bad$id!script',
    operation: 'create',
    actor: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: {
      qrId: 'bad$id!script',
      owner: 'user_a',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedRulePillar: 'Pillar 3: isValidId() regex guard',
  },
];
