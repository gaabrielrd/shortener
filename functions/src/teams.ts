import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { MemberDocument, TeamDocument } from './contracts/firestore.js';
import { isGoogleAuthToken } from './profile.js';
import { CALLABLE_OPTIONS } from './runtime.js';

const MAX_TEAM_NAME_LENGTH = 80;

export function normalizeTeamName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Informe o nome da equipe.', {
      field: 'name',
      reason: 'required',
    });
  }

  const name = value.trim();
  if (name.length > MAX_TEAM_NAME_LENGTH) {
    throw new HttpsError('invalid-argument', 'O nome da equipe deve ter no máximo 80 caracteres.', {
      field: 'name',
      reason: 'too-long',
    });
  }

  return name;
}

export function buildInitialTeamRecords(
  teamId: string,
  uid: string,
  displayName: string,
  email: string,
  name: string,
  now: Timestamp,
): { readonly team: TeamDocument; readonly member: MemberDocument } {
  return {
    team: {
      id: teamId,
      name,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
    },
    member: {
      uid,
      teamId,
      role: 'admin',
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      joinedAt: now,
    },
  };
}

export const createTeam = onCall(CALLABLE_OPTIONS, async (request) => {
  if (request.auth === undefined) {
    throw new HttpsError('unauthenticated', 'Uma sessão Google válida é obrigatória.');
  }

  const token = request.auth.token as Record<string, unknown>;
  if (!isGoogleAuthToken(token)) {
    throw new HttpsError('permission-denied', 'Somente contas Google podem criar equipes.');
  }

  const displayName = token['name'];
  const email = token['email'];
  if (typeof displayName !== 'string' || typeof email !== 'string') {
    throw new HttpsError('failed-precondition', 'A conta Google deve fornecer nome e e-mail.');
  }

  const input = request.data as { readonly name?: unknown } | null;
  const name = normalizeTeamName(input?.name);
  const uid = request.auth.uid;
  const app = getApps().length > 0 ? getApp() : initializeApp();
  const firestore = getFirestore(app);
  const teamRef = firestore.collection('teams').doc();
  const memberRef = teamRef.collection('members').doc(uid);
  const records = buildInitialTeamRecords(
    teamRef.id,
    uid,
    displayName,
    email,
    name,
    Timestamp.now(),
  );

  await firestore.runTransaction((transaction) => {
    transaction.create(teamRef, records.team);
    transaction.create(memberRef, records.member);
    return Promise.resolve();
  });

  return {
    team: {
      id: teamRef.id,
      name: records.team.name,
      role: records.member.role,
    },
  };
});
