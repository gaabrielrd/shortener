import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { UserDocument } from './contracts/firestore.js';
import { CALLABLE_OPTIONS } from './runtime.js';

export function isGoogleAuthToken(token: Record<string, unknown>): boolean {
  const firebaseClaim = token['firebase'];
  if (typeof firebaseClaim !== 'object' || firebaseClaim === null) return false;
  return (firebaseClaim as Record<string, unknown>)['sign_in_provider'] === 'google.com';
}

export function buildUserProfile(
  uid: string,
  displayName: string,
  email: string,
  now: Timestamp,
  createdAt: Timestamp = now,
): UserDocument {
  return {
    uid,
    displayName: displayName.trim(),
    email: email.trim().toLowerCase(),
    createdAt,
    updatedAt: now,
  };
}

export const ensureUserProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  if (request.auth === undefined) {
    throw new HttpsError('unauthenticated', 'Uma sessão Google válida é obrigatória.');
  }

  const uid = request.auth.uid;
  const token = request.auth.token as Record<string, unknown>;
  if (!isGoogleAuthToken(token)) {
    throw new HttpsError('permission-denied', 'Somente contas Google podem acessar o Short Links.');
  }
  const displayName = token['name'];
  const email = token['email'];
  if (typeof displayName !== 'string' || typeof email !== 'string') {
    throw new HttpsError('failed-precondition', 'A conta Google deve fornecer nome e e-mail.');
  }

  const app = getApps().length > 0 ? getApp() : initializeApp();
  const firestore = getFirestore(app);
  const profileRef = firestore.collection('users').doc(uid);

  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(profileRef);
    const now = Timestamp.now();
    const createdAt = existing.exists
      ? (existing.get('createdAt') as Timestamp | undefined)
      : undefined;
    transaction.set(profileRef, buildUserProfile(uid, displayName, email, now, createdAt));
  });

  return { uid };
});
