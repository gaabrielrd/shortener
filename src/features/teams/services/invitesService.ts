import { FirebaseError } from 'firebase/app';
import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '@/shared/services/firebase';
import type {
  ConsumeInviteResult,
  CreateInviteResult,
  InviteFailure,
  InviteOperationResult,
  TeamInvite,
} from '../model/invite';

export interface InvitesService {
  readonly subscribe: (
    teamId: string,
    onInvites: (invites: readonly TeamInvite[]) => void,
    onError: (failure: InviteFailure) => void,
  ) => () => void;
  readonly create: (teamId: string, expiresAt: string) => Promise<CreateInviteResult>;
  readonly cancel: (teamId: string, inviteId: string) => Promise<InviteOperationResult>;
  readonly consume: (token: string) => Promise<ConsumeInviteResult>;
  readonly copy: (value: string) => Promise<boolean>;
}

function failureFrom(error: unknown): InviteFailure {
  if (error instanceof FirebaseError) {
    const details: unknown = (error as FirebaseError & { readonly details?: unknown }).details;
    const reason =
      typeof details === 'object' && details !== null
        ? (details as Record<string, unknown>)['reason']
        : undefined;
    if (reason === 'expired') {
      return { code: 'invites/expired', message: 'Este convite já venceu.' };
    }
    if (reason === 'canceled') {
      return { code: 'invites/canceled', message: 'Este convite foi cancelado.' };
    }
    if (error.code === 'functions/unauthenticated') {
      return { code: 'invites/unauthenticated', message: 'Sua sessão expirou. Entre novamente.' };
    }
    if (error.code === 'functions/permission-denied' || error.code === 'permission-denied') {
      return { code: 'invites/forbidden', message: 'Você não pode gerenciar estes convites.' };
    }
    if (error.code === 'functions/not-found') {
      return {
        code: 'invites/not-found',
        message: 'Este convite não existe ou não está disponível.',
      };
    }
    if (error.code === 'functions/invalid-argument') {
      return {
        code: 'invites/validation',
        message: 'Escolha uma data e hora futuras.',
        field: 'expiresAt',
      };
    }
    if (error.code === 'functions/unavailable' || error.code === 'unavailable') {
      return { code: 'invites/unavailable', message: 'Não foi possível acessar os convites.' };
    }
  }
  return {
    code: 'invites/unknown',
    message: 'Não foi possível concluir a operação com o convite.',
  };
}

function timestampIso(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('toDate' in value)) return null;
  return (value as { toDate(): Date }).toDate().toISOString();
}

function inviteFrom(id: string, data: DocumentData): TeamInvite {
  const record = data as Record<string, unknown>;
  const teamId = record['teamId'];
  const createdBy = record['createdBy'];
  const expiresAt = timestampIso(record['expiresAt']);
  const canceledAt = record['canceledAt'] === null ? null : timestampIso(record['canceledAt']);
  const createdAt = timestampIso(record['createdAt']);
  if (
    typeof teamId !== 'string' ||
    typeof createdBy !== 'string' ||
    expiresAt === null ||
    createdAt === null ||
    (record['canceledAt'] !== null && canceledAt === null)
  ) {
    throw new Error('Convite inválido.');
  }
  return { id, teamId, createdBy, expiresAt, canceledAt, createdAt };
}

export function createFirebaseInvitesService(): InvitesService {
  return {
    subscribe(teamId, onInvites, onError) {
      const { firestore } = getFirebaseServices();
      return onSnapshot(
        query(collection(firestore, 'inviteTokens'), where('teamId', '==', teamId)),
        (snapshot) => {
          try {
            const invites = snapshot.docs
              .map((item) => inviteFrom(item.id, item.data()))
              .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
            onInvites(invites);
          } catch (error) {
            onError(failureFrom(error));
          }
        },
        (error) => onError(failureFrom(error)),
      );
    },

    async create(teamId, expiresAt) {
      try {
        const callable = httpsCallable<
          { readonly teamId: string; readonly expiresAt: string },
          { readonly token: string; readonly invite: TeamInvite }
        >(getFirebaseServices().functions, 'createInvite');
        const result = await callable({ teamId, expiresAt });
        return { ok: true, token: result.data.token, invite: result.data.invite };
      } catch (error) {
        return { ok: false, failure: failureFrom(error) };
      }
    },

    async cancel(teamId, inviteId) {
      try {
        const callable = httpsCallable(getFirebaseServices().functions, 'cancelInvite');
        await callable({ teamId, inviteId });
        return { ok: true };
      } catch (error) {
        return { ok: false, failure: failureFrom(error) };
      }
    },

    async consume(token) {
      try {
        const callable = httpsCallable<
          { readonly token: string },
          { readonly teamId: string; readonly teamName: string; readonly alreadyMember: boolean }
        >(getFirebaseServices().functions, 'consumeInvite');
        const result = await callable({ token });
        return { ok: true, ...result.data };
      } catch (error) {
        return { ok: false, failure: failureFrom(error) };
      }
    },

    async copy(value) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    },
  };
}
