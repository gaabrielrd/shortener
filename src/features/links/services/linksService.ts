import { FirebaseError } from 'firebase/app';
import {
  collection,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { env } from '@/shared/config';
import { getFirebaseServices } from '@/shared/services/firebase';
import type { TeamRole } from '@/features/teams';
import {
  normalizeSlug,
  type CreateLinkResult,
  type HistoryCursor,
  type HistoryPage,
  type LinkFailure,
  type LinkHistoryEntry,
  type LinkOperationResult,
  type LinkStatusCommand,
  type ShortLink,
} from '../model/link';

export interface LinksService {
  readonly subscribe: (
    teamId: string,
    role: TeamRole,
    uid: string,
    onLinks: (links: readonly ShortLink[]) => void,
    onError: (failure: LinkFailure) => void,
  ) => () => void;
  readonly create: (
    teamId: string,
    slug: string,
    destinationUrl: string,
  ) => Promise<CreateLinkResult>;
  readonly updateDestination: (
    teamId: string,
    slug: string,
    destinationUrl: string,
  ) => Promise<LinkOperationResult>;
  readonly changeStatus: (
    teamId: string,
    slug: string,
    command: LinkStatusCommand,
  ) => Promise<LinkOperationResult>;
  readonly loadHistory: (slug: string, cursor?: HistoryCursor) => Promise<HistoryPage>;
  readonly publicUrl: (slug: string) => string;
  readonly copy: (value: string) => Promise<boolean>;
}

function failureFrom(error: unknown): LinkFailure {
  if (error instanceof FirebaseError) {
    const details: unknown = (error as FirebaseError & { readonly details?: unknown }).details;
    const record =
      typeof details === 'object' && details !== null
        ? (details as Record<string, unknown>)
        : undefined;
    const field = record?.['field'];
    const reason = record?.['reason'];
    if (error.code === 'functions/already-exists' || reason === 'conflict') {
      return {
        code: 'links/conflict',
        field: 'slug',
        message: 'Este endereço curto já está em uso.',
      };
    }
    if (error.code === 'functions/invalid-argument') {
      if (field === 'destinationUrl') {
        return {
          code: 'links/validation',
          field: 'destinationUrl',
          message: 'Informe um destino absoluto iniciado por http:// ou https://.',
        };
      }
      return {
        code: 'links/validation',
        field: 'slug',
        message:
          reason === 'reserved'
            ? 'Este endereço é reservado pelo sistema.'
            : 'Use de 3 a 50 letras minúsculas, números ou hífens, sem hífen nas pontas.',
      };
    }
    if (error.code === 'functions/unauthenticated') {
      return { code: 'links/unauthenticated', message: 'Sua sessão expirou. Entre novamente.' };
    }
    if (error.code === 'functions/not-found' || error.code === 'not-found') {
      return { code: 'links/not-found', message: 'Este link não foi encontrado.' };
    }
    if (error.code === 'functions/failed-precondition') {
      return {
        code: 'links/invalid-transition',
        field: 'status',
        message: 'Esta mudança de estado não está disponível.',
      };
    }
    if (error.code === 'functions/permission-denied' || error.code === 'permission-denied') {
      return { code: 'links/forbidden', message: 'Você não pode acessar os links desta equipe.' };
    }
    if (error.code === 'functions/unavailable' || error.code === 'unavailable') {
      return { code: 'links/unavailable', message: 'Não foi possível acessar os links.' };
    }
  }
  return { code: 'links/unknown', message: 'Não foi possível concluir a operação com o link.' };
}

function timestampIso(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('toDate' in value)) return null;
  return (value as { toDate(): Date }).toDate().toISOString();
}

function linkFrom(slug: string, data: DocumentData): ShortLink {
  const record = data as Record<string, unknown>;
  const createdAt =
    typeof record['createdAt'] === 'string'
      ? record['createdAt']
      : timestampIso(record['createdAt']);
  const updatedAt =
    typeof record['updatedAt'] === 'string'
      ? record['updatedAt']
      : timestampIso(record['updatedAt']);
  if (
    typeof record['teamId'] !== 'string' ||
    typeof record['createdBy'] !== 'string' ||
    typeof record['destinationUrl'] !== 'string' ||
    (record['status'] !== 'active' &&
      record['status'] !== 'disabled' &&
      record['status'] !== 'archived') ||
    typeof record['totalClicks'] !== 'number' ||
    createdAt === null ||
    updatedAt === null
  ) {
    throw new Error('Link inválido.');
  }
  return {
    slug,
    teamId: record['teamId'],
    createdBy: record['createdBy'],
    destinationUrl: record['destinationUrl'],
    status: record['status'],
    totalClicks: record['totalClicks'],
    createdAt,
    updatedAt,
  };
}

function historyFrom(id: string, data: DocumentData): LinkHistoryEntry {
  const record = data as Record<string, unknown>;
  const createdAt = timestampIso(record['createdAt']);
  const action = record['action'];
  if (
    (action !== 'created' &&
      action !== 'destination_changed' &&
      action !== 'disabled' &&
      action !== 'archived' &&
      action !== 'restored') ||
    typeof record['actorId'] !== 'string' ||
    (record['previousValue'] !== null && typeof record['previousValue'] !== 'string') ||
    (record['nextValue'] !== null && typeof record['nextValue'] !== 'string') ||
    createdAt === null
  ) {
    throw new Error('Histórico inválido.');
  }
  return {
    id,
    action,
    actorId: record['actorId'],
    previousValue: record['previousValue'],
    nextValue: record['nextValue'],
    createdAt,
  };
}

function operationFrom(value: unknown): { readonly changed: boolean; readonly link: ShortLink } {
  if (typeof value !== 'object' || value === null) throw new Error('Resposta inválida.');
  const record = value as Record<string, unknown>;
  const link = record['link'];
  if (
    typeof record['changed'] !== 'boolean' ||
    typeof link !== 'object' ||
    link === null ||
    typeof (link as Record<string, unknown>)['slug'] !== 'string'
  ) {
    throw new Error('Resposta inválida.');
  }
  const linkRecord = link as Record<string, unknown>;
  return { changed: record['changed'], link: linkFrom(linkRecord['slug'] as string, linkRecord) };
}

export function createFirebaseLinksService(): LinksService {
  return {
    subscribe(teamId, role, uid, onLinks, onError) {
      const constraints: QueryConstraint[] = [where('teamId', '==', teamId)];
      if (role === 'member') constraints.push(where('createdBy', '==', uid));
      constraints.push(orderBy('createdAt', 'desc'));
      const linksQuery = query(
        collection(getFirebaseServices().firestore, 'links'),
        ...constraints,
      );
      return onSnapshot(
        linksQuery,
        (snapshot) => {
          try {
            onLinks(snapshot.docs.map((item) => linkFrom(item.id, item.data())));
          } catch (error) {
            onError(failureFrom(error));
          }
        },
        (error) => onError(failureFrom(error)),
      );
    },

    async create(teamId, slug, destinationUrl) {
      try {
        const callable = httpsCallable<
          { readonly teamId: string; readonly slug: string; readonly destinationUrl: string },
          { readonly link: unknown }
        >(getFirebaseServices().functions, 'createLink');
        const response = await callable({
          teamId,
          slug: normalizeSlug(slug),
          destinationUrl: destinationUrl.trim(),
        });
        const raw = response.data.link;
        if (
          typeof raw !== 'object' ||
          raw === null ||
          typeof (raw as Record<string, unknown>)['slug'] !== 'string'
        ) {
          throw new Error('Resposta de criação inválida.');
        }
        const record = raw as Record<string, unknown>;
        return { ok: true, link: linkFrom(record['slug'] as string, record) };
      } catch (error) {
        return { ok: false, failure: failureFrom(error) };
      }
    },

    async updateDestination(teamId, slug, destinationUrl) {
      try {
        const callable = httpsCallable<
          { readonly teamId: string; readonly slug: string; readonly destinationUrl: string },
          unknown
        >(getFirebaseServices().functions, 'updateLinkDestination');
        return {
          ok: true,
          ...operationFrom(
            (
              await callable({
                teamId,
                slug: normalizeSlug(slug),
                destinationUrl: destinationUrl.trim(),
              })
            ).data,
          ),
        };
      } catch (error) {
        return { ok: false, failure: failureFrom(error) };
      }
    },

    async changeStatus(teamId, slug, command) {
      try {
        const callable = httpsCallable<
          { readonly teamId: string; readonly slug: string; readonly command: LinkStatusCommand },
          unknown
        >(getFirebaseServices().functions, 'changeLinkStatus');
        return {
          ok: true,
          ...operationFrom((await callable({ teamId, slug: normalizeSlug(slug), command })).data),
        };
      } catch (error) {
        return { ok: false, failure: failureFrom(error) };
      }
    },

    async loadHistory(slug, cursor) {
      const constraints: QueryConstraint[] = [
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
      ];
      if (cursor !== undefined) {
        constraints.push(startAfter(Timestamp.fromDate(new Date(cursor.createdAt)), cursor.id));
      }
      constraints.push(limit(11));
      const snapshot = await getDocs(
        query(
          collection(getFirebaseServices().firestore, 'links', normalizeSlug(slug), 'history'),
          ...constraints,
        ),
      );
      const entries = snapshot.docs.slice(0, 10).map((item) => historyFrom(item.id, item.data()));
      const last = entries.at(-1);
      return {
        entries,
        nextCursor:
          snapshot.size > 10 && last !== undefined
            ? { id: last.id, createdAt: last.createdAt }
            : null,
      };
    },

    publicUrl(slug) {
      return `${env.publicShortBaseUrl}/${normalizeSlug(slug)}`;
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
