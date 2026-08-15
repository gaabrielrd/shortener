import { FirebaseError } from 'firebase/app';
import { collection, onSnapshot, query, type DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '@/shared/services/firebase';
import type { MemberFailure, MemberOperationResult, TeamMember } from '../model/member';
import type { TeamRole } from '../model/team';

export type MembershipCommand =
  | {
      readonly action: 'change-role';
      readonly teamId: string;
      readonly targetUid: string;
      readonly role: TeamRole;
    }
  | { readonly action: 'remove'; readonly teamId: string; readonly targetUid: string }
  | { readonly action: 'leave'; readonly teamId: string };

export interface MembersService {
  subscribe(
    teamId: string,
    onMembers: (members: readonly TeamMember[]) => void,
    onError: (failure: MemberFailure) => void,
  ): () => void;
  execute(command: MembershipCommand): Promise<MemberOperationResult>;
}

function failureFrom(error: unknown): MemberFailure {
  if (error instanceof FirebaseError) {
    const details: unknown = (error as FirebaseError & { readonly details?: unknown }).details;
    const reason =
      typeof details === 'object' && details !== null
        ? (details as Record<string, unknown>)['reason']
        : undefined;
    if (reason === 'last-admin') {
      return {
        code: 'members/last-admin',
        message: 'Promova outro membro antes de remover ou rebaixar o último administrador.',
      };
    }
    if (error.code === 'functions/unauthenticated') {
      return { code: 'members/unauthenticated', message: 'Sua sessão expirou. Entre novamente.' };
    }
    if (error.code === 'functions/permission-denied' || error.code === 'permission-denied') {
      return {
        code: 'members/forbidden',
        message: 'Você não pode gerenciar membros desta equipe.',
      };
    }
    if (error.code === 'functions/not-found') {
      return { code: 'members/not-found', message: 'O membro não foi encontrado.' };
    }
    if (error.code === 'functions/unavailable' || error.code === 'unavailable') {
      return { code: 'members/unavailable', message: 'Não foi possível acessar os membros.' };
    }
  }
  return { code: 'members/unknown', message: 'Não foi possível concluir a operação com membros.' };
}

function memberFrom(id: string, data: DocumentData): TeamMember {
  const uid: unknown = data['uid'];
  const displayName: unknown = data['displayName'];
  const email: unknown = data['email'];
  const role: unknown = data['role'];
  if (
    uid !== id ||
    typeof displayName !== 'string' ||
    typeof email !== 'string' ||
    (role !== 'admin' && role !== 'member')
  ) {
    throw new Error('Associação de membro inválida.');
  }
  return { uid, displayName, email, role };
}

export function createFirebaseMembersService(): MembersService {
  return {
    subscribe(teamId, onMembers, onError) {
      const { firestore } = getFirebaseServices();
      return onSnapshot(
        query(collection(firestore, 'teams', teamId, 'members')),
        (snapshot) => {
          try {
            const members = snapshot.docs
              .map((item) => memberFrom(item.id, item.data()))
              .sort((left, right) => left.displayName.localeCompare(right.displayName, 'pt-BR'));
            onMembers(members);
          } catch (error) {
            onError(failureFrom(error));
          }
        },
        (error) => onError(failureFrom(error)),
      );
    },

    async execute(command) {
      try {
        const callable = httpsCallable<MembershipCommand, { readonly ok: boolean }>(
          getFirebaseServices().functions,
          'updateMembership',
        );
        await callable(command);
        return { ok: true };
      } catch (error) {
        return { ok: false, failure: failureFrom(error) };
      }
    },
  };
}
