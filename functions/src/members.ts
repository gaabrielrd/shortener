import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { MembershipRole } from './contracts/firestore.js';
import { isGoogleAuthToken } from './profile.js';
import { CALLABLE_OPTIONS } from './runtime.js';

export type MembershipAction = 'change-role' | 'remove' | 'leave';

export interface MembershipCommand {
  readonly action: MembershipAction;
  readonly teamId: string;
  readonly targetUid: string;
  readonly role?: MembershipRole;
}

function readIdentifier(value: unknown, field: 'teamId' | 'targetUid'): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('/')) {
    throw new HttpsError('invalid-argument', `O campo ${field} é inválido.`, { field });
  }
  return value;
}

export function normalizeMembershipCommand(value: unknown, actorUid: string): MembershipCommand {
  if (typeof value !== 'object' || value === null) {
    throw new HttpsError('invalid-argument', 'Informe a ação de membro.');
  }
  const data = value as Record<string, unknown>;
  const action = data['action'];
  if (action !== 'change-role' && action !== 'remove' && action !== 'leave') {
    throw new HttpsError('invalid-argument', 'A ação de membro é inválida.', { field: 'action' });
  }
  const teamId = readIdentifier(data['teamId'], 'teamId');
  const targetUid = action === 'leave' ? actorUid : readIdentifier(data['targetUid'], 'targetUid');
  const role = data['role'];
  if (action === 'change-role' && role !== 'admin' && role !== 'member') {
    throw new HttpsError('invalid-argument', 'O nível do membro é inválido.', { field: 'role' });
  }
  if (action === 'change-role') {
    return { action, teamId, targetUid, role: role as MembershipRole };
  }
  return { action, teamId, targetUid };
}

export function assertAdminContinuity(
  currentRole: MembershipRole,
  nextRole: MembershipRole | null,
  adminCount: number,
): void {
  if (currentRole === 'admin' && nextRole !== 'admin' && adminCount <= 1) {
    throw new HttpsError(
      'failed-precondition',
      'Promova outro membro antes de remover ou rebaixar o último administrador.',
      { reason: 'last-admin' },
    );
  }
}

async function assertContinuityInTransaction(
  transaction: Transaction,
  teamMembers: FirebaseFirestore.CollectionReference,
  currentRole: MembershipRole,
  nextRole: MembershipRole | null,
): Promise<void> {
  if (currentRole !== 'admin' || nextRole === 'admin') return;
  const administrators = await transaction.get(teamMembers.where('role', '==', 'admin'));
  assertAdminContinuity(currentRole, nextRole, administrators.size);
}

export async function applyMembershipCommand(
  firestore: Firestore,
  actorUid: string,
  command: MembershipCommand,
): Promise<void> {
  const members = firestore.collection('teams').doc(command.teamId).collection('members');
  const actorRef = members.doc(actorUid);
  const targetRef = members.doc(command.targetUid);

  await firestore.runTransaction(async (transaction) => {
    const actorSnapshot = await transaction.get(actorRef);
    if (!actorSnapshot.exists) {
      throw new HttpsError('permission-denied', 'Você não participa desta equipe.');
    }
    const actorRole: unknown = actorSnapshot.get('role');
    if (actorRole !== 'admin' && actorRole !== 'member') {
      throw new HttpsError('permission-denied', 'Sua associação de equipe é inválida.');
    }

    if (command.action !== 'leave' && actorRole !== 'admin') {
      throw new HttpsError('permission-denied', 'Somente administradores gerenciam membros.');
    }

    const targetSnapshot =
      command.targetUid === actorUid ? actorSnapshot : await transaction.get(targetRef);
    if (!targetSnapshot.exists) {
      throw new HttpsError('not-found', 'O membro não foi encontrado.');
    }
    const targetRole: unknown = targetSnapshot.get('role');
    if (targetRole !== 'admin' && targetRole !== 'member') {
      throw new HttpsError('failed-precondition', 'A associação do membro é inválida.');
    }

    const nextRole = command.action === 'change-role' ? (command.role ?? null) : null;
    await assertContinuityInTransaction(transaction, members, targetRole, nextRole);

    if (command.action === 'change-role') {
      transaction.update(targetRef, { role: command.role });
    } else {
      transaction.delete(targetRef);
    }
  });
}

export const updateMembership = onCall(CALLABLE_OPTIONS, async (request) => {
  if (request.auth === undefined) {
    throw new HttpsError('unauthenticated', 'Uma sessão Google válida é obrigatória.');
  }
  const token = request.auth.token as Record<string, unknown>;
  if (!isGoogleAuthToken(token)) {
    throw new HttpsError('permission-denied', 'Somente contas Google podem gerenciar membros.');
  }

  const command = normalizeMembershipCommand(request.data, request.auth.uid);
  const app = getApps().length > 0 ? getApp() : initializeApp();
  await applyMembershipCommand(getFirestore(app), request.auth.uid, command);
  return { ok: true };
});
