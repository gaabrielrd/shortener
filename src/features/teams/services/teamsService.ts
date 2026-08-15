import { FirebaseError } from 'firebase/app';
import {
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '@/shared/services/firebase';
import type { CreateTeamResult, Team, TeamFailure, TeamRole } from '../model/team';

export interface TeamsService {
  subscribe(
    uid: string,
    onTeams: (teams: readonly Team[]) => void,
    onError: (failure: TeamFailure) => void,
  ): () => void;
  createTeam(name: string): Promise<CreateTeamResult>;
}

function toFailure(error: unknown): TeamFailure {
  if (error instanceof FirebaseError) {
    if (error.code === 'functions/invalid-argument') {
      const details: unknown = (error as FirebaseError & { readonly details?: unknown }).details;
      const reason =
        typeof details === 'object' && details !== null
          ? (details as Record<string, unknown>)['reason']
          : undefined;
      return reason === 'too-long'
        ? {
            code: 'teams/name-too-long',
            message: 'O nome da equipe deve ter no máximo 80 caracteres.',
            field: 'name',
          }
        : {
            code: 'teams/name-required',
            message: 'Informe o nome da equipe.',
            field: 'name',
          };
    }
    if (error.code === 'functions/unauthenticated') {
      return {
        code: 'teams/unauthenticated',
        message: 'Sua sessão expirou. Entre novamente para continuar.',
      };
    }
    if (error.code === 'functions/permission-denied' || error.code === 'permission-denied') {
      return { code: 'teams/forbidden', message: 'Você não pode acessar esta equipe.' };
    }
    if (error.code === 'functions/already-exists') {
      return {
        code: 'teams/conflict',
        message: 'A equipe não pôde ser reservada. Tente criar novamente.',
      };
    }
    if (error.code === 'unavailable' || error.code === 'functions/unavailable') {
      return {
        code: 'teams/unavailable',
        message: 'Não foi possível acessar as equipes. Tente novamente.',
      };
    }
  }

  return {
    code: 'teams/unknown',
    message: 'Não foi possível concluir a operação com equipes. Tente novamente.',
  };
}

function readMembership(snapshot: QueryDocumentSnapshot<DocumentData>): {
  readonly teamId: string;
  readonly role: TeamRole;
} {
  const data = snapshot.data();
  const teamId: unknown = data['teamId'];
  const role: unknown = data['role'];
  if (typeof teamId !== 'string' || (role !== 'admin' && role !== 'member')) {
    throw new Error('Associação de equipe inválida.');
  }
  return { teamId, role };
}

function readTeam(id: string, role: TeamRole, data: DocumentData | undefined): Team {
  const name: unknown = data?.['name'];
  if (typeof name !== 'string') {
    throw new Error('Equipe associada não encontrada.');
  }
  return { id, name, role };
}

function readCreatedTeam(value: unknown): Team {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Resposta de criação de equipe inválida.');
  }
  const data = value as Record<string, unknown>;
  if (
    typeof data['id'] !== 'string' ||
    typeof data['name'] !== 'string' ||
    (data['role'] !== 'admin' && data['role'] !== 'member')
  ) {
    throw new Error('Resposta de criação de equipe inválida.');
  }
  return { id: data['id'], name: data['name'], role: data['role'] };
}

export function createFirebaseTeamsService(): TeamsService {
  return {
    subscribe(uid, onTeams, onError) {
      const { firestore } = getFirebaseServices();
      const memberships = query(collectionGroup(firestore, 'members'), where('uid', '==', uid));
      let active = true;
      let revision = 0;

      const unsubscribe = onSnapshot(
        memberships,
        (snapshot) => {
          revision += 1;
          const currentRevision = revision;
          void Promise.all(
            snapshot.docs.map(async (membershipSnapshot) => {
              const membership = readMembership(membershipSnapshot);
              const teamSnapshot = await getDoc(doc(firestore, 'teams', membership.teamId));
              return readTeam(
                membership.teamId,
                membership.role,
                teamSnapshot.exists() ? teamSnapshot.data() : undefined,
              );
            }),
          )
            .then((teams) => {
              if (active && currentRevision === revision) {
                onTeams(teams.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')));
              }
            })
            .catch((error: unknown) => {
              if (active && currentRevision === revision) onError(toFailure(error));
            });
        },
        (error) => {
          if (active) onError(toFailure(error));
        },
      );

      return () => {
        active = false;
        revision += 1;
        unsubscribe();
      };
    },

    async createTeam(name) {
      try {
        const callable = httpsCallable<{ readonly name: string }, { readonly team: unknown }>(
          getFirebaseServices().functions,
          'createTeam',
        );
        const response = await callable({ name: name.trim() });
        return { ok: true, team: readCreatedTeam(response.data.team) };
      } catch (error) {
        return { ok: false, failure: toFailure(error) };
      }
    },
  };
}
