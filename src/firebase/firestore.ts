import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { BOOTSTRAPPED_ADMIN_EMAIL, db } from './config';
import { handleFirestoreError, OperationType } from './errorHandler';
import type {
  BulkOperationLog,
  ContactMessageRecord,
  PaperSize,
  PrintBatchRecord,
  QRCodeRecord,
  QRStatus,
  QRType,
  ScanEventRecord,
  UserProfile,
} from '../types';

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const HEX_REGEX = /^#[0-9a-fA-F]{3,8}$/;
const FIRESTORE_BATCH_CHUNK = 450;

export function generateUniqueId(prefix = 'qr'): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let rand = '';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) {
    rand += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${rand}`;
}

export function generateSecureEditToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = 'tok_';
  const bytes = new Uint8Array(28);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export function sanitizeSlug(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (cleaned.length >= 3 && ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return generateUniqueId('qr');
}

function clampString(val: string, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

export function formatCardNumber(index: number, prefix = 'CARD'): string {
  return `${prefix}-${String(index).padStart(4, '0')}`;
}

export function getResolvedDestination(qr: QRCodeRecord): string {
  return (qr.currentUrl !== undefined ? qr.currentUrl : qr.currentLink) || qr.currentLink || '';
}

// ---------------------------------------------------------------------------
// User Profiles & Admin Registry
// ---------------------------------------------------------------------------

export async function ensureUserProfile(params: {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  emailVerified: boolean;
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const isBootstrapAdmin =
      params.emailVerified &&
      params.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    const payload = {
      uid: params.uid,
      name: clampString(params.name || params.email.split('@')[0] || 'Member', 100),
      email: clampString(params.email, 254),
      photoURL: clampString(params.photoURL || '', 50000),
      role: isBootstrapAdmin ? ('admin' as const) : ('user' as const),
      plan: isBootstrapAdmin ? ('enterprise' as const) : ('free' as const),
      status: 'active' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, payload);

    if (isBootstrapAdmin) {
      const adminRef = doc(db, 'admins', params.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: params.uid,
          email: payload.email,
          createdAt: serverTimestamp(),
        });
      }
    }

    const createdSnap = await getDoc(userRef);
    return createdSnap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function checkIsAdmin(uid: string, email: string | null, emailVerified: boolean): Promise<boolean> {
  if (!emailVerified) return false;
  if (email && email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function updateUserProfileRecord(
  uid: string,
  updates: { name: string; photoURL: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      name: clampString(updates.name, 100) || 'Member',
      photoURL: clampString(updates.photoURL, 50000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateUserRecord(
  targetUid: string,
  updates: Partial<Pick<UserProfile, 'role' | 'plan' | 'status' | 'name'>>,
  targetEmail: string
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name !== undefined) clean.name = clampString(updates.name, 100);
    if (updates.role !== undefined) clean.role = updates.role;
    if (updates.plan !== undefined) clean.plan = updates.plan;
    if (updates.status !== undefined) clean.status = updates.status;

    await updateDoc(doc(db, 'users', targetUid), clean);

    if (updates.role === 'admin') {
      await setDoc(doc(db, 'admins', targetUid), {
        uid: targetUid,
        email: clampString(targetEmail, 254),
        createdAt: serverTimestamp(),
      });
    } else if (updates.role === 'user') {
      try {
        await deleteDoc(doc(db, 'admins', targetUid));
      } catch {
        // Ignore if admin doc did not exist
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserDataRecords(uid: string): Promise<void> {
  try {
    const qrSnap = await getDocs(query(collection(db, 'qrcodes'), where('owner', '==', uid)));
    const scanSnap = await getDocs(query(collection(db, 'scans'), where('qrOwner', '==', uid)));
    const batchSnap = await getDocs(query(collection(db, 'print_batches'), where('owner', '==', uid)));

    const allRefs = [
      ...qrSnap.docs.map((d) => d.ref),
      ...scanSnap.docs.map((d) => d.ref),
      ...batchSnap.docs.map((d) => d.ref),
      doc(db, 'users', uid),
    ];

    for (let i = 0; i < allRefs.length; i += FIRESTORE_BATCH_CHUNK) {
      const chunk = allRefs.slice(i, i + FIRESTORE_BATCH_CHUNK);
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}

// ---------------------------------------------------------------------------
// QR Codes CRUD & Subscriptions
// ---------------------------------------------------------------------------

export interface CreateQRInput {
  owner: string;
  title: string;
  customSlug?: string;
  originalLink: string;
  qrType: QRType;
  customColor: string;
  bgColor: string;
  logo: string;
  expiryDate: string;
  status?: QRStatus;
  cardNumber?: string;
  batchId?: string;
  batchName?: string;
}

export async function createQRCode(input: CreateQRInput): Promise<QRCodeRecord> {
  const qrId = input.customSlug ? sanitizeSlug(input.customSlug) : generateUniqueId('qr');
  const path = `qrcodes/${qrId}`;
  try {
    const existing = await getDoc(doc(db, 'qrcodes', qrId));
    const finalId = existing.exists() ? generateUniqueId('qr') : qrId;
    const finalRef = doc(db, 'qrcodes', finalId);
    const tokenRef = doc(db, 'qr_edit_tokens', finalId);

    const safeColor = HEX_REGEX.test(input.customColor) ? input.customColor : '#0F172A';
    const safeBg = HEX_REGEX.test(input.bgColor) ? input.bgColor : '#FFFFFF';
    const link = clampString(input.originalLink, 2048);

    const payload = {
      qrId: finalId,
      owner: input.owner,
      title: clampString(input.title || 'Untitled QR Code', 120),
      shortSlug: finalId,
      originalLink: link,
      currentLink: link,
      currentUrl: link,
      cardNumber: clampString(input.cardNumber || '', 64),
      batchId: clampString(input.batchId || '', 64),
      batchName: clampString(input.batchName || '', 120),
      qrImage: '',
      qrType: input.qrType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      scanCount: 0,
      status: input.status ?? 'active',
      customColor: safeColor,
      bgColor: safeBg,
      logo: clampString(input.logo || '', 50000),
      expiryDate: clampString(input.expiryDate || '', 40),
    };

    const wb = writeBatch(db);
    wb.set(finalRef, payload);
    wb.set(tokenRef, {
      qrId: finalId,
      owner: input.owner,
      token: generateSecureEditToken(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await wb.commit();

    const snap = await getDoc(finalRef);
    return snap.data() as QRCodeRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createBulkQRCodes(inputs: CreateQRInput[]): Promise<QRCodeRecord[]> {
  const results: QRCodeRecord[] = [];
  for (const item of inputs) {
    const created = await createQRCode(item);
    results.push(created);
  }
  return results;
}

export async function updateQRCode(
  qrId: string,
  updates: Partial<
    Pick<
      QRCodeRecord,
      | 'title'
      | 'currentLink'
      | 'currentUrl'
      | 'cardNumber'
      | 'qrType'
      | 'status'
      | 'customColor'
      | 'bgColor'
      | 'logo'
      | 'expiryDate'
    >
  >
): Promise<void> {
  const path = `qrcodes/${qrId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.title !== undefined) clean.title = clampString(updates.title, 120) || 'Untitled QR';
    if (updates.currentUrl !== undefined || updates.currentLink !== undefined) {
      const nextUrl = clampString(
        updates.currentUrl !== undefined ? updates.currentUrl : updates.currentLink ?? '',
        2048
      );
      clean.currentLink = nextUrl;
      clean.currentUrl = nextUrl;
    }
    if (updates.cardNumber !== undefined) {
      clean.cardNumber = clampString(updates.cardNumber, 64);
    }
    if (updates.qrType !== undefined) clean.qrType = updates.qrType;
    if (updates.status !== undefined) clean.status = updates.status;
    if (updates.customColor !== undefined && HEX_REGEX.test(updates.customColor)) {
      clean.customColor = updates.customColor;
    }
    if (updates.bgColor !== undefined && HEX_REGEX.test(updates.bgColor)) {
      clean.bgColor = updates.bgColor;
    }
    if (updates.logo !== undefined) clean.logo = clampString(updates.logo, 50000);
    if (updates.expiryDate !== undefined) clean.expiryDate = clampString(updates.expiryDate, 40);

    await updateDoc(doc(db, 'qrcodes', qrId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteQRCode(qrId: string): Promise<void> {
  const path = `qrcodes/${qrId}`;
  try {
    await deleteDoc(doc(db, 'qrcodes', qrId));
    try {
      await deleteDoc(doc(db, 'qr_edit_tokens', qrId));
    } catch {
      // Ignore if token document did not exist
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getOrCreateQREditToken(qrId: string, ownerUid: string): Promise<string> {
  const path = `qr_edit_tokens/${qrId}`;
  try {
    const tokenRef = doc(db, 'qr_edit_tokens', qrId);
    const snap = await getDoc(tokenRef);
    if (snap.exists()) {
      return String(snap.data().token || '');
    }
    const freshToken = generateSecureEditToken();
    await setDoc(tokenRef, {
      qrId,
      owner: ownerUid,
      token: freshToken,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return freshToken;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function rotateQREditToken(qrId: string, ownerUid: string): Promise<string> {
  const path = `qr_edit_tokens/${qrId}`;
  try {
    const tokenRef = doc(db, 'qr_edit_tokens', qrId);
    const freshToken = generateSecureEditToken();
    const snap = await getDoc(tokenRef);
    if (snap.exists()) {
      await updateDoc(tokenRef, {
        token: freshToken,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(tokenRef, {
        qrId,
        owner: ownerUid,
        token: freshToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return freshToken;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateQRCodeWithToken(
  qrId: string,
  submittedToken: string,
  updates: { currentUrl: string; status?: QRStatus }
): Promise<void> {
  const cleanToken = submittedToken.trim();
  if (cleanToken.length < 16 || !ID_REGEX.test(cleanToken)) {
    throw new Error('Invalid edit token format. Check the secure token generated for this QR.');
  }

  const cleanUrl = clampString(updates.currentUrl, 2048);
  const wb = writeBatch(db);

  // Write-only atomic proof document verified synchronously by Firestore Rules
  wb.set(doc(db, 'qr_token_grants', qrId), {
    qrId,
    submittedToken: cleanToken,
    updatedAt: serverTimestamp(),
  });

  const qrUpdate: Record<string, unknown> = {
    currentLink: cleanUrl,
    currentUrl: cleanUrl,
    updatedAt: serverTimestamp(),
  };
  if (updates.status !== undefined) {
    qrUpdate.status = updates.status;
  }

  wb.update(doc(db, 'qrcodes', qrId), qrUpdate);
  await wb.commit();
}

export async function getPrintBatchName(batchId: string): Promise<string> {
  if (!batchId) return '';
  try {
    const snap = await getDoc(doc(db, 'print_batches', batchId));
    return snap.exists() ? String(snap.data().batchName || '') : '';
  } catch {
    return '';
  }
}

export async function getQRCodeById(qrId: string): Promise<QRCodeRecord | null> {
  if (!qrId || qrId.length < 3 || qrId.length > 64 || !ID_REGEX.test(qrId)) {
    return null;
  }
  const path = `qrcodes/${qrId}`;
  try {
    const snap = await getDoc(doc(db, 'qrcodes', qrId));
    return snap.exists() ? (snap.data() as QRCodeRecord) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeUserQRCodes(
  uid: string,
  onData: (items: QRCodeRecord[]) => void,
  onError?: (err: Error) => void,
  maxDocs = 500
): Unsubscribe {
  const path = 'qrcodes';
  const q = query(collection(db, 'qrcodes'), where('owner', '==', uid), limit(maxDocs));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as QRCodeRecord);
      rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Bulk Print Cards & Batch Manager (Optimized for 100,000+ Cards)
// ---------------------------------------------------------------------------

export interface GenerateBulkBatchInput {
  owner: string;
  batchName: string;
  cardCount: number;
  startCardNumber: number;
  cardPrefix?: string;
  paperSize: PaperSize;
  paperWidthMm: number;
  paperHeightMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
  rows: number;
  cols: number;
  qrXPercent: number;
  qrYPercent: number;
  qrSizePercent: number;
  templateUrl: string;
  defaultUrl: string;
  qrColor: string;
  qrBgColor: string;
  onProgress?: (completed: number, total: number, statusText: string) => void;
}

export interface GeneratedCardSummary {
  qrId: string;
  cardNumber: string;
  currentUrl: string;
  batchId: string;
}

export async function generateBulkPrintBatch(
  input: GenerateBulkBatchInput
): Promise<{
  batch: PrintBatchRecord;
  cards: GeneratedCardSummary[];
  logs: BulkOperationLog[];
}> {
  const batchId = generateUniqueId('batch');
  const count = Math.max(1, Math.min(10000, Math.floor(input.cardCount)));
  const startNum = Math.max(1, Math.floor(input.startCardNumber || 1));
  const prefix = clampString(input.cardPrefix || 'CARD', 16) || 'CARD';
  const safeBatchName = clampString(input.batchName || `Review Batch ${batchId}`, 120);
  const safeDefaultUrl = clampString(input.defaultUrl || '', 2048);
  const safeColor = HEX_REGEX.test(input.qrColor) ? input.qrColor : '#0F172A';
  const safeBg = HEX_REGEX.test(input.qrBgColor) ? input.qrBgColor : '#FFFFFF';
  const safeTemplateUrl = clampString(input.templateUrl || '', 500000);

  const logs: BulkOperationLog[] = [];
  const generatedCards: GeneratedCardSummary[] = [];

  try {
    input.onProgress?.(0, count, 'Creating batch metadata in Firestore...');

    const batchPayload = {
      batchId,
      owner: input.owner,
      batchName: safeBatchName,
      cardCount: count,
      startCardNumber: startNum,
      paperSize: input.paperSize,
      paperWidthMm: Number(input.paperWidthMm),
      paperHeightMm: Number(input.paperHeightMm),
      cardWidthMm: Number(input.cardWidthMm),
      cardHeightMm: Number(input.cardHeightMm),
      rows: Math.max(1, Math.min(50, Math.floor(input.rows))),
      cols: Math.max(1, Math.min(50, Math.floor(input.cols))),
      qrXPercent: Math.max(0, Math.min(100, Number(input.qrXPercent))),
      qrYPercent: Math.max(0, Math.min(100, Number(input.qrYPercent))),
      qrSizePercent: Math.max(5, Math.min(100, Number(input.qrSizePercent))),
      templateUrl: safeTemplateUrl,
      defaultUrl: safeDefaultUrl,
      qrColor: safeColor,
      qrBgColor: safeBg,
      status: 'active' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'print_batches', batchId), batchPayload);

    // Pre-generate unique IDs locally with 10-char crypto randomness (~32^10 = 1.1 quadrillion space)
    const usedIds = new Set<string>();
    for (let i = 0; i < count; i++) {
      let qrId = generateUniqueId('c');
      while (usedIds.has(qrId)) {
        qrId = generateUniqueId('c');
      }
      usedIds.add(qrId);
      const cardNumber = formatCardNumber(startNum + i, prefix);
      generatedCards.push({
        qrId,
        cardNumber,
        currentUrl: safeDefaultUrl,
        batchId,
      });
    }

    // Write cards + paired secret edit tokens in atomic chunks (220 cards = 440 writes/commit)
    const CARD_WITH_TOKEN_CHUNK = 220;
    let committed = 0;
    for (let offset = 0; offset < generatedCards.length; offset += CARD_WITH_TOKEN_CHUNK) {
      const slice = generatedCards.slice(offset, offset + CARD_WITH_TOKEN_CHUNK);
      const wb = writeBatch(db);

      for (const card of slice) {
        const ref = doc(db, 'qrcodes', card.qrId);
        wb.set(ref, {
          qrId: card.qrId,
          owner: input.owner,
          title: clampString(`${safeBatchName} ${card.cardNumber}`, 120),
          shortSlug: card.qrId,
          originalLink: safeDefaultUrl,
          currentLink: safeDefaultUrl,
          currentUrl: safeDefaultUrl,
          cardNumber: card.cardNumber,
          batchId,
          batchName: safeBatchName,
          qrImage: '',
          qrType: 'google_review' as QRType,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          scanCount: 0,
          status: 'active' as QRStatus,
          customColor: safeColor,
          bgColor: safeBg,
          logo: '',
          expiryDate: '',
        });

        wb.set(doc(db, 'qr_edit_tokens', card.qrId), {
          qrId: card.qrId,
          owner: input.owner,
          token: generateSecureEditToken(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await wb.commit();
      committed += slice.length;
      logs.push({
        status: 'success',
        message: `Committed cards ${slice[0].cardNumber} to ${slice[slice.length - 1].cardNumber} (${slice.length} dynamic QRs + secure edit tokens)`,
      });
      input.onProgress?.(
        committed,
        count,
        `Saved ${committed.toLocaleString()} of ${count.toLocaleString()} unique QR cards...`
      );
    }

    const batchSnap = await getDoc(doc(db, 'print_batches', batchId));
    const savedBatch = batchSnap.data() as PrintBatchRecord;
    return { batch: savedBatch, cards: generatedCards, logs };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `print_batches/${batchId}`);
  }
}

export function subscribePrintBatches(
  uid: string,
  isAdmin: boolean,
  onData: (batches: PrintBatchRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'print_batches';
  const q = isAdmin
    ? query(collection(db, 'print_batches'), limit(200))
    : query(collection(db, 'print_batches'), where('owner', '==', uid), limit(200));

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as PrintBatchRecord);
      rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export async function getBatchCards(
  batchId: string,
  ownerUid: string,
  isAdmin: boolean
): Promise<QRCodeRecord[]> {
  const path = `qrcodes?batchId=${batchId}`;
  try {
    const constraints: QueryConstraint[] = [where('batchId', '==', batchId)];
    if (!isAdmin) {
      constraints.push(where('owner', '==', ownerUid));
    }
    const snap = await getDocs(query(collection(db, 'qrcodes'), ...constraints));
    const cards = snap.docs.map((d) => d.data() as QRCodeRecord);
    cards.sort((a, b) => (a.cardNumber || a.qrId).localeCompare(b.cardNumber || b.qrId, undefined, { numeric: true }));
    return cards;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deletePrintBatch(
  batchId: string,
  ownerUid: string,
  isAdmin: boolean,
  deleteCards: boolean,
  onProgress?: (deleted: number, total: number) => void
): Promise<number> {
  const path = `print_batches/${batchId}`;
  try {
    let deletedCardsCount = 0;
    if (deleteCards) {
      const cards = await getBatchCards(batchId, ownerUid, isAdmin);
      for (let i = 0; i < cards.length; i += FIRESTORE_BATCH_CHUNK) {
        const slice = cards.slice(i, i + FIRESTORE_BATCH_CHUNK);
        const wb = writeBatch(db);
        slice.forEach((c) => wb.delete(doc(db, 'qrcodes', c.qrId)));
        await wb.commit();
        deletedCardsCount += slice.length;
        onProgress?.(deletedCardsCount, cards.length);
      }
    }
    await deleteDoc(doc(db, 'print_batches', batchId));
    return deletedCardsCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Scalable 100,000+ QR Cards Query, Pagination & CSV Import/Export
// ---------------------------------------------------------------------------

export interface FetchQRCardsPageParams {
  uid: string;
  isAdmin: boolean;
  pageSize: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  searchMode: 'all' | 'qrId' | 'cardNumber';
  searchValue: string;
  batchIdFilter: string;
  statusFilter: 'all' | QRStatus;
}

export interface PaginatedQRCardsResult {
  items: QRCodeRecord[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export async function getQRCardCounts(
  uid: string,
  isAdmin: boolean,
  batchIdFilter?: string
): Promise<{ total: number; active: number }> {
  try {
    const baseConstraints: QueryConstraint[] = [];
    if (!isAdmin) baseConstraints.push(where('owner', '==', uid));
    if (batchIdFilter && batchIdFilter !== 'all') {
      baseConstraints.push(where('batchId', '==', batchIdFilter));
    }

    const totalSnap = await getCountFromServer(query(collection(db, 'qrcodes'), ...baseConstraints));
    const activeSnap = await getCountFromServer(
      query(collection(db, 'qrcodes'), ...baseConstraints, where('status', '==', 'active'))
    );
    return {
      total: totalSnap.data().count,
      active: activeSnap.data().count,
    };
  } catch {
    return { total: 0, active: 0 };
  }
}

export async function fetchQRCardsPage(
  params: FetchQRCardsPageParams
): Promise<PaginatedQRCardsResult> {
  const { uid, isAdmin, pageSize, cursor, searchMode, searchValue, batchIdFilter, statusFilter } =
    params;
  const trimmed = searchValue.trim();

  try {
    // 1. O(1) Direct QR ID Lookup (scales cleanly to 10M+ cards)
    if (searchMode === 'qrId' && trimmed) {
      const exact = await getQRCodeById(trimmed);
      if (!exact) return { items: [], lastDoc: null, hasMore: false };
      if (!isAdmin && exact.owner !== uid) return { items: [], lastDoc: null, hasMore: false };
      if (batchIdFilter !== 'all' && (exact.batchId || '') !== batchIdFilter) {
        return { items: [], lastDoc: null, hasMore: false };
      }
      if (statusFilter !== 'all' && exact.status !== statusFilter) {
        return { items: [], lastDoc: null, hasMore: false };
      }
      return { items: [exact], lastDoc: null, hasMore: false };
    }

    // 2. Card Number Indexed Prefix Query
    if (searchMode === 'cardNumber' && trimmed) {
      const constraints: QueryConstraint[] = [];
      if (!isAdmin) constraints.push(where('owner', '==', uid));
      if (batchIdFilter !== 'all') constraints.push(where('batchId', '==', batchIdFilter));
      constraints.push(where('cardNumber', '>=', trimmed));
      constraints.push(where('cardNumber', '<=', `${trimmed}\uf8ff`));
      constraints.push(limit(pageSize + 1));

      try {
        const snap = await getDocs(query(collection(db, 'qrcodes'), ...constraints));
        let docs = snap.docs;
        const hasMore = docs.length > pageSize;
        if (hasMore) docs = docs.slice(0, pageSize);
        let items = docs.map((d) => d.data() as QRCodeRecord);
        if (statusFilter !== 'all') {
          items = items.filter((i) => i.status === statusFilter);
        }
        return { items, lastDoc: docs[docs.length - 1] ?? null, hasMore };
      } catch {
        // Fallback if composite index hasn't been created yet: single equality lookup on cardNumber
        const fallbackConstraints: QueryConstraint[] = [where('cardNumber', '==', trimmed)];
        if (!isAdmin) fallbackConstraints.push(where('owner', '==', uid));
        const snap = await getDocs(query(collection(db, 'qrcodes'), ...fallbackConstraints, limit(pageSize)));
        const items = snap.docs
          .map((d) => d.data() as QRCodeRecord)
          .filter((i) => (batchIdFilter === 'all' || i.batchId === batchIdFilter) && (statusFilter === 'all' || i.status === statusFilter));
        return { items, lastDoc: null, hasMore: false };
      }
    }

    // 3. Paginated Listing (Owner / Batch / Status) with composite-index fallback
    const buildConstraints = (useOrderBy: boolean): QueryConstraint[] => {
      const c: QueryConstraint[] = [];
      if (!isAdmin) c.push(where('owner', '==', uid));
      if (batchIdFilter !== 'all') c.push(where('batchId', '==', batchIdFilter));
      if (statusFilter !== 'all') c.push(where('status', '==', statusFilter));
      if (useOrderBy) c.push(orderBy('createdAt', 'desc'));
      if (cursor) c.push(startAfter(cursor));
      c.push(limit(pageSize + 1));
      return c;
    };

    try {
      const snap = await getDocs(query(collection(db, 'qrcodes'), ...buildConstraints(true)));
      let docs = snap.docs;
      const hasMore = docs.length > pageSize;
      if (hasMore) docs = docs.slice(0, pageSize);
      return {
        items: docs.map((d) => d.data() as QRCodeRecord),
        lastDoc: docs[docs.length - 1] ?? null,
        hasMore,
      };
    } catch {
      // Automatic index-free fallback so page never crashes if composite indexes aren't deployed yet
      const snap = await getDocs(query(collection(db, 'qrcodes'), ...buildConstraints(false)));
      let docs = snap.docs;
      const hasMore = docs.length > pageSize;
      if (hasMore) docs = docs.slice(0, pageSize);
      const items = docs.map((d) => d.data() as QRCodeRecord);
      items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      return {
        items,
        lastDoc: docs[docs.length - 1] ?? null,
        hasMore,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'qrcodes');
  }
}

export interface CsvCardImportRow {
  rowNumber: number;
  cardNumber: string;
  qrId: string;
  destinationUrl: string;
}

export interface CsvImportSummary {
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  logs: BulkOperationLog[];
}

export async function importBulkCSVQRCards(params: {
  owner: string;
  isAdmin: boolean;
  rows: CsvCardImportRow[];
  batchId?: string;
  onProgress?: (processed: number, total: number) => void;
}): Promise<CsvImportSummary> {
  const { owner, isAdmin, rows, batchId = '', onProgress } = params;
  const logs: BulkOperationLog[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let processed = 0;

  const CHUNK_SIZE = 100;
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    const wb = writeBatch(db);
    let pendingOps = 0;

    for (const row of chunk) {
      const cleanCardNum = clampString(row.cardNumber, 64);
      const cleanQrId = clampString(row.qrId, 64);
      const cleanUrl = clampString(row.destinationUrl, 2048);

      if (cleanUrl && !/^(https?:\/\/|mailto:|tel:|sms:|upi:)/i.test(cleanUrl)) {
        // Normalize bare domains cleanly
        const normalized = `https://${cleanUrl}`;
        row.destinationUrl = normalized;
      }
      const finalUrl = clampString(row.destinationUrl, 2048);

      try {
        if (cleanQrId) {
          if (cleanQrId.length < 3 || !ID_REGEX.test(cleanQrId)) {
            errorCount++;
            logs.push({
              row: row.rowNumber,
              cardNumber: cleanCardNum,
              qrId: cleanQrId,
              status: 'error',
              message: 'Invalid QR ID format (must be 3-64 alphanumeric, hyphen, or underscore characters).',
            });
            continue;
          }

          const existingSnap = await getDoc(doc(db, 'qrcodes', cleanQrId));
          if (existingSnap.exists()) {
            const existingData = existingSnap.data() as QRCodeRecord;
            if (!isAdmin && existingData.owner !== owner) {
              errorCount++;
              logs.push({
                row: row.rowNumber,
                cardNumber: cleanCardNum,
                qrId: cleanQrId,
                status: 'error',
                message: 'Permission denied: QR ID belongs to another workspace.',
              });
              continue;
            }
            if (!isAdmin && existingData.status === 'archived') {
              errorCount++;
              logs.push({
                row: row.rowNumber,
                cardNumber: cleanCardNum,
                qrId: cleanQrId,
                status: 'error',
                message: 'QR is archived and locked for edits.',
              });
              continue;
            }

            const updatePayload: Record<string, unknown> = {
              currentLink: finalUrl,
              currentUrl: finalUrl,
              updatedAt: serverTimestamp(),
            };
            if (cleanCardNum) {
              updatePayload.cardNumber = cleanCardNum;
            }
            wb.update(doc(db, 'qrcodes', cleanQrId), updatePayload);
            pendingOps++;
            updatedCount++;
            logs.push({
              row: row.rowNumber,
              cardNumber: cleanCardNum || existingData.cardNumber || '',
              qrId: cleanQrId,
              status: 'success',
              message: `Updated destination URL -> ${finalUrl || '(empty)'}`,
            });
          } else {
            // Provided QR ID does not exist yet -> create it with that exact QR ID + paired edit token
            wb.set(doc(db, 'qrcodes', cleanQrId), {
              qrId: cleanQrId,
              owner,
              title: clampString(cleanCardNum ? `Review Card ${cleanCardNum}` : `Card ${cleanQrId}`, 120),
              shortSlug: cleanQrId,
              originalLink: finalUrl,
              currentLink: finalUrl,
              currentUrl: finalUrl,
              cardNumber: cleanCardNum,
              batchId: clampString(batchId, 64),
              batchName: '',
              qrImage: '',
              qrType: 'google_review' as QRType,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              scanCount: 0,
              status: 'active' as QRStatus,
              customColor: '#0F172A',
              bgColor: '#FFFFFF',
              logo: '',
              expiryDate: '',
            });
            wb.set(doc(db, 'qr_edit_tokens', cleanQrId), {
              qrId: cleanQrId,
              owner,
              token: generateSecureEditToken(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            pendingOps += 2;
            createdCount++;
            logs.push({
              row: row.rowNumber,
              cardNumber: cleanCardNum,
              qrId: cleanQrId,
              status: 'success',
              message: `Created new Dynamic QR with custom ID -> ${finalUrl || '(empty)'}`,
            });
          }
        } else {
          // Empty QR ID -> generate a fresh unique Dynamic QR automatically + paired edit token
          const newId = generateUniqueId('c');
          wb.set(doc(db, 'qrcodes', newId), {
            qrId: newId,
            owner,
            title: clampString(cleanCardNum ? `Review Card ${cleanCardNum}` : `Card ${newId}`, 120),
            shortSlug: newId,
            originalLink: finalUrl,
            currentLink: finalUrl,
            currentUrl: finalUrl,
            cardNumber: cleanCardNum,
            batchId: clampString(batchId, 64),
            batchName: '',
            qrImage: '',
            qrType: 'google_review' as QRType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            scanCount: 0,
            status: 'active' as QRStatus,
            customColor: '#0F172A',
            bgColor: '#FFFFFF',
            logo: '',
            expiryDate: '',
          });
          wb.set(doc(db, 'qr_edit_tokens', newId), {
            qrId: newId,
            owner,
            token: generateSecureEditToken(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          pendingOps += 2;
          createdCount++;
          logs.push({
            row: row.rowNumber,
            cardNumber: cleanCardNum,
            qrId: newId,
            status: 'success',
            message: `Auto-generated new Dynamic QR (${newId})`,
          });
        }
      } catch (rowErr) {
        errorCount++;
        logs.push({
          row: row.rowNumber,
          cardNumber: cleanCardNum,
          qrId: cleanQrId,
          status: 'error',
          message: rowErr instanceof Error ? rowErr.message : 'Unexpected row error.',
        });
      }
    }

    if (pendingOps > 0) {
      try {
        await wb.commit();
      } catch (commitErr) {
        errorCount += pendingOps;
        logs.push({
          status: 'error',
          message: `Chunk commit failed (rows ${start + 1}-${start + chunk.length}): ${
            commitErr instanceof Error ? commitErr.message : 'Write denied'
          }`,
        });
      }
    }

    processed += chunk.length;
    onProgress?.(processed, rows.length);
  }

  return { createdCount, updatedCount, errorCount, logs };
}

// ---------------------------------------------------------------------------
// Scan Recording (Atomic Batch) & Analytics Subscriptions
// ---------------------------------------------------------------------------

export async function recordQRScanAtomic(
  qr: QRCodeRecord,
  meta: {
    deviceType: 'Mobile' | 'Desktop' | 'Tablet';
    browser: string;
    os: string;
    country: string;
    city: string;
    referrer: string;
  }
): Promise<void> {
  const scanId = generateUniqueId('sc');
  const path = `scans/${scanId}`;
  try {
    const batch = writeBatch(db);
    const qrRef = doc(db, 'qrcodes', qr.qrId);
    const scanRef = doc(db, 'scans', scanId);

    batch.update(qrRef, {
      scanCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    batch.set(scanRef, {
      scanId,
      qrId: qr.qrId,
      qrOwner: qr.owner,
      qrTitle: clampString(qr.title, 120) || 'QR Code',
      qrType: clampString(qr.qrType, 32),
      deviceType: meta.deviceType,
      browser: clampString(meta.browser || 'Unknown', 40),
      os: clampString(meta.os || 'Unknown', 40),
      country: clampString(meta.country || 'Unknown', 64),
      city: clampString(meta.city || 'Unknown', 64),
      referrer: clampString(meta.referrer || '', 256),
      timestamp: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserScans(
  uid: string,
  onData: (items: ScanEventRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'scans';
  const q = query(collection(db, 'scans'), where('qrOwner', '==', uid), limit(1000));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as ScanEventRecord);
      rows.sort((a, b) => (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0));
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Contact Messages
// ---------------------------------------------------------------------------

export async function submitContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId: string;
}): Promise<void> {
  const messageId = generateUniqueId('msg');
  const path = `contact_messages/${messageId}`;
  try {
    await setDoc(doc(db, 'contact_messages', messageId), {
      messageId,
      name: clampString(input.name, 100),
      email: clampString(input.email, 254),
      subject: clampString(input.subject, 150),
      message: clampString(input.message, 2000),
      userId: clampString(input.userId, 128),
      status: 'new',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ---------------------------------------------------------------------------
// Admin Global Subscriptions
// ---------------------------------------------------------------------------

export function subscribeAdminAllUsers(
  onData: (items: UserProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users'), limit(500)),
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as UserProfile);
      rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export function subscribeAdminAllQRCodes(
  onData: (items: QRCodeRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'qrcodes'), limit(500)),
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as QRCodeRecord);
      rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'qrcodes');
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export function subscribeAdminAllScans(
  onData: (items: ScanEventRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'scans'), limit(1000)),
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as ScanEventRecord);
      rows.sort((a, b) => (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0));
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'scans');
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export function subscribeAdminContactMessages(
  onData: (items: ContactMessageRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'contact_messages'), limit(300)),
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as ContactMessageRecord);
      rows.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'contact_messages');
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}
