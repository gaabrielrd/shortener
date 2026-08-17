import { createHash, randomBytes } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getAdminFirestore } from './admin.js';
import type { InviteTokenDocument, MemberDocument } from './contracts/firestore.js';
import { isGoogleAuthToken } from './profile.js';
import { CALLABLE_OPTIONS } from './runtime.js';

export type InviteStatus = 'active' | 'expired' | 'canceled';

function readIdentifier(value: unknown, field: 'teamId' | 'inviteId'): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('/')) {
    throw new HttpsError('invalid-argument', `O campo ${field} é inválido.`, { field });
  }
  return value;
}

export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export function normalizeInviteToken(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new HttpsError('not-found', 'Convite inválido.');
  }
  return value;
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function normalizeInviteExpiration(value: unknown, now: Timestamp): Timestamp {
  if (typeof value !== 'string' || value.length > 64) {
    throw new HttpsError('invalid-argument', 'Informe uma data de validade futura.', {
      field: 'expiresAt',
    });
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= now.toMillis()) {
    throw new HttpsError('invalid-argument', 'A validade precisa estar no futuro.', {
      field: 'expiresAt',
    });
  }
  return Timestamp.fromMillis(milliseconds);
}

export function getInviteStatus(
  invite: Pick<InviteTokenDocument, 'expiresAt' | 'canceledAt'>,
  now: Timestamp,
): InviteStatus {
  if (invite.canceledAt !== null) return 'canceled';
  return invite.expiresAt.toMillis() <= now.toMillis() ? 'expired' : 'active';
}

function assertAdministratorSnapshot(membership: FirebaseFirestore.DocumentSnapshot): void {
  if (!membership.exists || membership.get('role') !== 'admin') {
    throw new HttpsError('permission-denied', 'Somente administradores gerenciam convites.');
  }
}

export async function createInviteRecord(
  firestore: Firestore,
  input: {
    readonly teamId: string;
    readonly uid: string;
    readonly expiresAt: Timestamp;
    readonly now: Timestamp;
    readonly token: string;
  },
): Promise<{ readonly id: string; readonly token: string; readonly invite: InviteTokenDocument }> {
  const id = hashInviteToken(input.token);
  const invite: InviteTokenDocument = {
    teamId: input.teamId,
    createdBy: input.uid,
    expiresAt: input.expiresAt,
    canceledAt: null,
    role: 'member',
    createdAt: input.now,
  };
  const inviteReference = firestore.collection('inviteTokens').doc(id);
  const membershipReference = firestore.doc(`teams/${input.teamId}/members/${input.uid}`);
  await firestore.runTransaction(async (transaction) => {
    assertAdministratorSnapshot(await transaction.get(membershipReference));
    transaction.create(inviteReference, invite);
  });
  return { id, token: input.token, invite };
}

export async function cancelInviteRecord(
  firestore: Firestore,
  input: {
    readonly teamId: string;
    readonly inviteId: string;
    readonly uid: string;
    readonly now: Timestamp;
  },
): Promise<void> {
  const reference = firestore.collection('inviteTokens').doc(input.inviteId);
  const membershipReference = firestore.doc(`teams/${input.teamId}/members/${input.uid}`);
  await firestore.runTransaction(async (transaction) => {
    const [membership, snapshot] = await Promise.all([
      transaction.get(membershipReference),
      transaction.get(reference),
    ]);
    assertAdministratorSnapshot(membership);
    if (!snapshot.exists || snapshot.get('teamId') !== input.teamId) {
      throw new HttpsError('not-found', 'Convite não encontrado.');
    }
    if (snapshot.get('canceledAt') === null) {
      transaction.update(reference, { canceledAt: input.now });
    }
  });
}

export async function consumeInviteRecord(
  firestore: Firestore,
  input: {
    readonly token: string;
    readonly uid: string;
    readonly displayName: string;
    readonly email: string;
    readonly now: Timestamp;
  },
): Promise<{
  readonly teamId: string;
  readonly teamName: string;
  readonly alreadyMember: boolean;
}> {
  const inviteId = hashInviteToken(input.token);
  const inviteReference = firestore.collection('inviteTokens').doc(inviteId);

  return firestore.runTransaction(async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteReference);
    if (!inviteSnapshot.exists) throw new HttpsError('not-found', 'Convite inválido.');
    const invite = inviteSnapshot.data() as InviteTokenDocument;
    const status = getInviteStatus(invite, input.now);
    if (status !== 'active') {
      throw new HttpsError('failed-precondition', 'Este convite não está mais disponível.', {
        reason: status,
      });
    }

    const teamReference = firestore.collection('teams').doc(invite.teamId);
    const memberReference = teamReference.collection('members').doc(input.uid);
    const [teamSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(teamReference),
      transaction.get(memberReference),
    ]);
    if (!teamSnapshot.exists || typeof teamSnapshot.get('name') !== 'string') {
      throw new HttpsError('not-found', 'Convite inválido.');
    }
    if (memberSnapshot.exists) {
      return {
        teamId: invite.teamId,
        teamName: teamSnapshot.get('name') as string,
        alreadyMember: true,
      };
    }

    const member: MemberDocument = {
      uid: input.uid,
      teamId: invite.teamId,
      role: 'member',
      displayName: input.displayName.trim(),
      email: input.email.trim().toLowerCase(),
      joinedAt: input.now,
    };
    transaction.create(memberReference, member);
    return {
      teamId: invite.teamId,
      teamName: teamSnapshot.get('name') as string,
      alreadyMember: false,
    };
  });
}

function requireGoogleIdentity(request: {
  readonly auth?: { readonly uid: string; readonly token: Record<string, unknown> };
}): { readonly uid: string; readonly displayName: string; readonly email: string } {
  if (request.auth === undefined || !isGoogleAuthToken(request.auth.token)) {
    throw new HttpsError('unauthenticated', 'Uma sessão Google válida é obrigatória.');
  }
  const displayName = request.auth.token['name'];
  const email = request.auth.token['email'];
  if (typeof displayName !== 'string' || typeof email !== 'string') {
    throw new HttpsError('failed-precondition', 'A conta Google deve fornecer nome e e-mail.');
  }
  return { uid: request.auth.uid, displayName, email };
}

function database(): Firestore {
  return getAdminFirestore();
}

export const createInvite = onCall(CALLABLE_OPTIONS, async (request) => {
  const identity = requireGoogleIdentity(request);
  const data = request.data as Record<string, unknown> | null;
  const teamId = readIdentifier(data?.['teamId'], 'teamId');
  const now = Timestamp.now();
  const expiresAt = normalizeInviteExpiration(data?.['expiresAt'], now);
  const result = await createInviteRecord(database(), {
    teamId,
    uid: identity.uid,
    expiresAt,
    now,
    token: generateInviteToken(),
  });
  return {
    token: result.token,
    invite: {
      id: result.id,
      teamId,
      createdBy: identity.uid,
      expiresAt: result.invite.expiresAt.toDate().toISOString(),
      canceledAt: null,
      createdAt: result.invite.createdAt.toDate().toISOString(),
    },
  };
});

export const cancelInvite = onCall(CALLABLE_OPTIONS, async (request) => {
  const identity = requireGoogleIdentity(request);
  const data = request.data as Record<string, unknown> | null;
  await cancelInviteRecord(database(), {
    teamId: readIdentifier(data?.['teamId'], 'teamId'),
    inviteId: readIdentifier(data?.['inviteId'], 'inviteId'),
    uid: identity.uid,
    now: Timestamp.now(),
  });
  return { ok: true };
});

export const consumeInvite = onCall(CALLABLE_OPTIONS, async (request) => {
  const identity = requireGoogleIdentity(request);
  const data = request.data as Record<string, unknown> | null;
  const token = normalizeInviteToken(data?.['token']);
  return consumeInviteRecord(database(), { ...identity, token, now: Timestamp.now() });
});
