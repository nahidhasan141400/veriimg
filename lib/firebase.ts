'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  intToBinary32,
  intToHex32,
  sanitizeAndValidateHttpsUrl,
  MAX_TITLE_LENGTH,
  MAX_THUMBNAIL_LENGTH,
  MAX_UINT32,
} from './watermark-engine';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const SUPER_ADMIN_EMAIL = 'nahid.main.ai@gmail.com';
export const BOOTSTRAPPED_ADMIN_EMAIL = SUPER_ADMIN_EMAIL;
export const ADMIN_EMAIL_REGEX = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
export const MAX_ADMIN_DISPLAY_NAME_LENGTH = 80;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot (per firebase-integration-rpc guidelines)
let connectionTested = false;
export async function validateFirestoreConnection(): Promise<void> {
  if (connectionTested || typeof window === 'undefined') return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export interface WatermarkRecord {
  id: number;
  hex: string;
  binary: string;
  targetUrl: string;
  title: string;
  thumbnailDataUrl: string;
  delta: number;
  createdBy: string;
  createdAtIso: string;
  sourceSampleUrl?: string;
}

export interface AdminRecord {
  email: string;
  displayName: string;
  role: 'admin';
  addedBy: string;
  createdAtIso: string;
}

export const INITIAL_SEED_ADMINS: AdminRecord[] = [
  {
    email: 'alex.rivera@veriimg.org',
    displayName: 'Alex Rivera (Media Verification Lead)',
    role: 'admin',
    addedBy: SUPER_ADMIN_EMAIL,
    createdAtIso: '2026-11-02T10:30:00.000Z',
  },
  {
    email: 'sara.chen@veriimg.org',
    displayName: 'Sara Chen (Optical R&D Engineer)',
    role: 'admin',
    addedBy: SUPER_ADMIN_EMAIL,
    createdAtIso: '2026-11-05T15:10:00.000Z',
  },
];

export const INITIAL_SEED_RECORDS: WatermarkRecord[] = [
  {
    id: 10425,
    hex: '0x000028B9',
    binary: '00000000000000000010100010111001',
    targetUrl: 'https://chronograph.veriimg.org/authentic/10425',
    title: 'Titanium Chronograph Series I',
    thumbnailDataUrl: '/samples/watch.jpg',
    delta: 14,
    createdBy: 'system-seed',
    createdAtIso: '2026-11-01T14:20:00.000Z',
    sourceSampleUrl: '/samples/watch.jpg',
  },
  {
    id: 88412,
    hex: '0x0001595C',
    binary: '00000000000000010101100101011100',
    targetUrl: 'https://pavilion.veriimg.org/archive/88412',
    title: 'Glass Pavilion Architectural Study',
    thumbnailDataUrl: '/samples/architecture.jpg',
    delta: 14,
    createdBy: 'system-seed',
    createdAtIso: '2026-11-04T09:15:00.000Z',
    sourceSampleUrl: '/samples/architecture.jpg',
  },
  {
    id: 524287,
    hex: '0x0007FFFF',
    binary: '00000000000001111111111111111111',
    targetUrl: 'https://atelier.veriimg.org/vessels/524287',
    title: 'Monolith Ceramic Vessel No. 7',
    thumbnailDataUrl: '/samples/sculpture.jpg',
    delta: 16,
    createdBy: 'system-seed',
    createdAtIso: '2026-11-07T18:45:00.000Z',
    sourceSampleUrl: '/samples/sculpture.jpg',
  },
];

/**
 * Checks whether a signed-in Google email is authorized as either the Super Admin
 * (`nahid.main.ai@gmail.com`) or a delegated admin in Firestore `/admins/{email}`.
 */
export async function checkIsAuthorizedAdmin(
  rawEmail: string | null | undefined,
  localAdmins: AdminRecord[]
): Promise<{ authorized: boolean; role: 'super_admin' | 'admin' | null }> {
  if (!rawEmail) {
    return { authorized: false, role: null };
  }
  const email = rawEmail.trim().toLowerCase();
  if (email === SUPER_ADMIN_EMAIL) {
    return { authorized: true, role: 'super_admin' };
  }
  if (!ADMIN_EMAIL_REGEX.test(email) || email.length < 5 || email.length > 128) {
    return { authorized: false, role: null };
  }

  const inLocalList = localAdmins.some((a) => a.email.toLowerCase() === email);

  if (auth.currentUser && auth.currentUser.emailVerified) {
    const docPath = `admins/${email}`;
    try {
      const snap = await getDoc(doc(db, 'admins', email));
      if (snap.exists()) {
        return { authorized: true, role: 'admin' };
      }
    } catch (error) {
      if (inLocalList) {
        return { authorized: true, role: 'admin' };
      }
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch {
        return { authorized: false, role: null };
      }
    }
  }

  if (inLocalList) {
    return { authorized: true, role: 'admin' };
  }
  return { authorized: false, role: null };
}

/**
 * Subscribes to live Firestore `/admins` collection for the Super Admin allowlist table.
 */
export function subscribeToAdmins(
  onUpdate: (cloudAdmins: AdminRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'admins';
  const q = query(collection(db, 'admins'), where('addedBy', '==', SUPER_ADMIN_EMAIL));
  return onSnapshot(
    q,
    (snapshot) => {
      const admins: AdminRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAtIso =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
            ? data.createdAt
            : new Date().toISOString();
        admins.push({
          email: String(data.email || docSnap.id).toLowerCase(),
          displayName: String(data.displayName || data.email || docSnap.id),
          role: 'admin',
          addedBy: String(data.addedBy || SUPER_ADMIN_EMAIL),
          createdAtIso,
        });
      });
      onUpdate(admins);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (structuredErr) {
        if (onError && structuredErr instanceof Error) {
          onError(structuredErr);
        }
      }
    }
  );
}

/**
 * Authorizes a new delegated administrator email in Firestore `/admins/{email}`.
 * Restricted exclusively to Super Admin (`nahid.main.ai@gmail.com`).
 */
export async function authorizeAdminInFirestore(params: {
  email: string;
  displayName: string;
}): Promise<AdminRecord> {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (
    normalizedEmail.length < 5 ||
    normalizedEmail.length > 128 ||
    !ADMIN_EMAIL_REGEX.test(normalizedEmail)
  ) {
    throw new Error('Please enter a valid Google email address (e.g., colleague@gmail.com).');
  }
  if (normalizedEmail === SUPER_ADMIN_EMAIL) {
    throw new Error(`${SUPER_ADMIN_EMAIL} is already the permanent Super Admin.`);
  }

  const safeDisplayName = (
    params.displayName.trim() || normalizedEmail.split('@')[0]
  ).slice(0, MAX_ADMIN_DISPLAY_NAME_LENGTH);

  const record: AdminRecord = {
    email: normalizedEmail,
    displayName: safeDisplayName,
    role: 'admin',
    addedBy: SUPER_ADMIN_EMAIL,
    createdAtIso: new Date().toISOString(),
  };

  const currentUser = auth.currentUser;
  if (
    currentUser &&
    currentUser.emailVerified &&
    currentUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL
  ) {
    const docPath = `admins/${normalizedEmail}`;
    try {
      await setDoc(doc(db, 'admins', normalizedEmail), {
        email: normalizedEmail,
        displayName: safeDisplayName,
        role: 'admin',
        addedBy: SUPER_ADMIN_EMAIL,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }

  return record;
}

/**
 * Revokes a delegated administrator's access by deleting `/admins/{email}` from Firestore.
 * Restricted exclusively to Super Admin (`nahid.main.ai@gmail.com`).
 */
export async function revokeAdminFromFirestore(rawEmail: string): Promise<void> {
  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (normalizedEmail === SUPER_ADMIN_EMAIL) {
    throw new Error('The Super Admin account cannot be revoked.');
  }

  const currentUser = auth.currentUser;
  if (
    currentUser &&
    currentUser.emailVerified &&
    currentUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL
  ) {
    const docPath = `admins/${normalizedEmail}`;
    try {
      await deleteDoc(doc(db, 'admins', normalizedEmail));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }
}

/**
 * Fetches a single watermark record by its 32-bit integer ID from Firestore,
 * merging with local session / seed records if not yet persisted to Firestore.
 */
export async function lookupWatermarkRecord(
  id: number,
  localRecords: WatermarkRecord[]
): Promise<WatermarkRecord | null> {
  if (!Number.isInteger(id) || id < 0 || id > MAX_UINT32) {
    return null;
  }

  const localMatch = localRecords.find((r) => r.id === id);

  const docPath = `watermarks/${id}`;
  try {
    const snap = await getDoc(doc(db, 'watermarks', String(id)));
    if (snap.exists()) {
      const data = snap.data();
      const createdAtIso =
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date().toISOString();
      return {
        id: Number(data.id),
        hex: String(data.hex),
        binary: String(data.binary),
        targetUrl: String(data.targetUrl),
        title: String(data.title || `Asset #${data.id}`),
        thumbnailDataUrl: String(data.thumbnailDataUrl || '/samples/watch.jpg'),
        delta: Number(data.delta || 14),
        createdBy: String(data.createdBy || 'admin'),
        createdAtIso,
      };
    }
  } catch (error) {
    if (localMatch) return localMatch;
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  return localMatch || null;
}

/**
 * Subscribes to live Firestore `/watermarks` collection updates using the bounded query
 * required by `firestore.rules` (`where('id', '>=', 0)`).
 */
export function subscribeToWatermarks(
  onUpdate: (cloudRecords: WatermarkRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'watermarks';
  const q = query(
    collection(db, 'watermarks'),
    where('id', '>=', 0),
    where('id', '<=', MAX_UINT32)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const records: WatermarkRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdAtIso =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
            ? data.createdAt
            : new Date().toISOString();
        records.push({
          id: Number(data.id),
          hex: String(data.hex),
          binary: String(data.binary),
          targetUrl: String(data.targetUrl),
          title: String(data.title || `Asset #${data.id}`),
          thumbnailDataUrl: String(data.thumbnailDataUrl || '/samples/watch.jpg'),
          delta: Number(data.delta || 14),
          createdBy: String(data.createdBy || 'admin'),
          createdAtIso,
        });
      });
      onUpdate(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (structuredErr) {
        if (onError && structuredErr instanceof Error) {
          onError(structuredErr);
        }
      }
    }
  );
}

/**
 * Saves a newly embedded watermark record to Firestore when authenticated as an admin,
 * enforcing all defensive payload constraints from firebase-blueprint.json.
 */
export async function saveWatermarkToFirestore(params: {
  id: number;
  targetUrl: string;
  title: string;
  thumbnailDataUrl: string;
  delta: number;
}): Promise<WatermarkRecord> {
  const { id, targetUrl, title, thumbnailDataUrl, delta } = params;
  if (!Number.isInteger(id) || id < 0 || id > MAX_UINT32) {
    throw new Error(`Integer ID must be between 0 and ${MAX_UINT32}.`);
  }

  const urlCheck = sanitizeAndValidateHttpsUrl(targetUrl);
  if (!urlCheck.valid) {
    throw new Error(urlCheck.error || 'Invalid https:// destination URL.');
  }

  const hex = intToHex32(id);
  const binary = intToBinary32(id);
  const safeTitle = (title.trim() || `Verified Asset #${id}`).slice(0, MAX_TITLE_LENGTH);
  const safeThumb =
    thumbnailDataUrl.length <= MAX_THUMBNAIL_LENGTH && thumbnailDataUrl.length >= 10
      ? thumbnailDataUrl
      : '/samples/watch.jpg';
  const safeDelta = Math.max(1, Math.min(64, Math.round(delta)));

  const currentUser = auth.currentUser;
  const createdBy = currentUser?.uid || 'local-admin-preview';
  const record: WatermarkRecord = {
    id,
    hex,
    binary,
    targetUrl: urlCheck.sanitized,
    title: safeTitle,
    thumbnailDataUrl: safeThumb,
    delta: safeDelta,
    createdBy,
    createdAtIso: new Date().toISOString(),
  };

  if (currentUser && currentUser.emailVerified) {
    const docPath = `watermarks/${id}`;
    try {
      await setDoc(doc(db, 'watermarks', String(id)), {
        id,
        hex,
        binary,
        targetUrl: urlCheck.sanitized,
        title: safeTitle,
        thumbnailDataUrl: safeThumb,
        delta: safeDelta,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }

  return record;
}

/**
 * Deletes a watermark record from Firestore when authenticated as an admin.
 */
export async function deleteWatermarkFromFirestore(id: number): Promise<void> {
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.emailVerified) {
    const docPath = `watermarks/${id}`;
    try {
      await deleteDoc(doc(db, 'watermarks', String(id)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }
}

export async function signInWithGoogleAdmin() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutAdmin() {
  return firebaseSignOut(auth);
}
