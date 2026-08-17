import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getAdminFirestore } from './admin.js';
import type { LinkDocument, LinkHistoryDocument, MemberDocument } from './contracts/firestore.js';
import { isGoogleAuthToken } from './profile.js';
import { CALLABLE_OPTIONS } from './runtime.js';

export type LinkStatusCommand = 'disable' | 'archive' | 'restore';

export const RESERVED_SLUGS = new Set([
  'api',
  'app',
  'assets',
  'favicon',
  'health',
  'invite',
  'login',
  'logout',
  'manifest',
  'robots',
  'styleguide',
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/;

function readTeamId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 128 ||
    value.includes('/')
  ) {
    throw new HttpsError('invalid-argument', 'A equipe informada é inválida.', { field: 'teamId' });
  }
  return value;
}

export function normalizeLinkSlug(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Informe um slug válido.', {
      field: 'slug',
      reason: 'invalid-format',
    });
  }
  const slug = value.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new HttpsError(
      'invalid-argument',
      'Use de 3 a 50 letras minúsculas, números ou hífens, sem hífen nas pontas.',
      { field: 'slug', reason: 'invalid-format' },
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new HttpsError('invalid-argument', 'Este endereço é reservado pelo sistema.', {
      field: 'slug',
      reason: 'reserved',
    });
  }
  return slug;
}

export function normalizeDestinationUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2_048) {
    throw new HttpsError('invalid-argument', 'Informe um destino HTTP ou HTTPS válido.', {
      field: 'destinationUrl',
      reason: 'invalid-url',
    });
  }
  try {
    const destination = new URL(value.trim());
    if (
      (destination.protocol !== 'http:' && destination.protocol !== 'https:') ||
      !destination.host
    ) {
      throw new Error('unsupported protocol');
    }
    return destination.toString();
  } catch {
    throw new HttpsError(
      'invalid-argument',
      'Informe um destino absoluto iniciado por http:// ou https://.',
      { field: 'destinationUrl', reason: 'invalid-url' },
    );
  }
}

function assertMembership(snapshot: FirebaseFirestore.DocumentSnapshot): MemberDocument {
  if (!snapshot.exists) {
    throw new HttpsError('permission-denied', 'Você não participa desta equipe.');
  }
  return snapshot.data() as MemberDocument;
}

function assertLinkManager(membership: MemberDocument, link: LinkDocument, uid: string): void {
  if (membership.role !== 'admin' && link.createdBy !== uid) {
    throw new HttpsError('permission-denied', 'Você não pode alterar este link.');
  }
}

export function nextLinkStatus(
  current: LinkDocument['status'],
  command: LinkStatusCommand,
): LinkDocument['status'] {
  if (command === 'archive') return 'archived';
  if (command === 'restore') return 'active';
  if (current === 'archived') {
    throw new HttpsError('failed-precondition', 'Restaure o link antes de desativá-lo.', {
      reason: 'invalid-transition',
    });
  }
  return 'disabled';
}

export async function createLinkRecord(
  firestore: Firestore,
  input: {
    readonly teamId: string;
    readonly uid: string;
    readonly slug: string;
    readonly destinationUrl: string;
    readonly now: Timestamp;
  },
): Promise<LinkDocument> {
  const linkReference = firestore.collection('links').doc(input.slug);
  const historyReference = linkReference.collection('history').doc();
  const membershipReference = firestore.doc(`teams/${input.teamId}/members/${input.uid}`);
  const link: LinkDocument = {
    teamId: input.teamId,
    createdBy: input.uid,
    destinationUrl: input.destinationUrl,
    status: 'active',
    totalClicks: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
  const history: LinkHistoryDocument = {
    action: 'created',
    actorId: input.uid,
    previousValue: null,
    nextValue: input.destinationUrl,
    createdAt: input.now,
  };

  await firestore.runTransaction(async (transaction) => {
    const [membership, existingLink] = await Promise.all([
      transaction.get(membershipReference),
      transaction.get(linkReference),
    ]);
    assertMembership(membership);
    if (existingLink.exists) {
      throw new HttpsError('already-exists', 'Este endereço curto já está em uso.', {
        field: 'slug',
        reason: 'conflict',
      });
    }
    transaction.create(linkReference, link);
    transaction.create(historyReference, history);
  });
  return link;
}

export async function updateLinkRecord(
  firestore: Firestore,
  input: {
    readonly teamId: string;
    readonly uid: string;
    readonly slug: string;
    readonly now: Timestamp;
    readonly change:
      | { readonly type: 'destination'; readonly destinationUrl: string }
      | { readonly type: 'status'; readonly command: LinkStatusCommand };
  },
): Promise<{ readonly changed: boolean; readonly link: LinkDocument }> {
  const linkReference = firestore.collection('links').doc(input.slug);
  const historyReference = linkReference.collection('history').doc();
  const membershipReference = firestore.doc(`teams/${input.teamId}/members/${input.uid}`);

  return firestore.runTransaction(async (transaction) => {
    const [membershipSnapshot, linkSnapshot] = await Promise.all([
      transaction.get(membershipReference),
      transaction.get(linkReference),
    ]);
    const membership = assertMembership(membershipSnapshot);
    if (!linkSnapshot.exists || linkSnapshot.get('teamId') !== input.teamId) {
      throw new HttpsError('not-found', 'Link não encontrado.');
    }
    const current = linkSnapshot.data() as LinkDocument;
    assertLinkManager(membership, current, input.uid);

    const previousValue =
      input.change.type === 'destination' ? current.destinationUrl : current.status;
    const nextValue =
      input.change.type === 'destination'
        ? input.change.destinationUrl
        : nextLinkStatus(current.status, input.change.command);
    if (previousValue === nextValue) return { changed: false, link: current };

    const link: LinkDocument =
      input.change.type === 'destination'
        ? { ...current, destinationUrl: nextValue, updatedAt: input.now }
        : { ...current, status: nextValue as LinkDocument['status'], updatedAt: input.now };
    const history: LinkHistoryDocument = {
      action:
        input.change.type === 'destination'
          ? 'destination_changed'
          : input.change.command === 'disable'
            ? 'disabled'
            : input.change.command === 'archive'
              ? 'archived'
              : 'restored',
      actorId: input.uid,
      previousValue,
      nextValue,
      createdAt: input.now,
    };
    transaction.update(linkReference, link);
    transaction.create(historyReference, history);
    return { changed: true, link };
  });
}

function database(): Firestore {
  return getAdminFirestore();
}

export const createLink = onCall(CALLABLE_OPTIONS, async (request) => {
  if (request.auth === undefined || !isGoogleAuthToken(request.auth.token)) {
    throw new HttpsError('unauthenticated', 'Uma sessão Google válida é obrigatória.');
  }
  const data = request.data as Record<string, unknown> | null;
  const teamId = readTeamId(data?.['teamId']);
  const slug = normalizeLinkSlug(data?.['slug']);
  const destinationUrl = normalizeDestinationUrl(data?.['destinationUrl']);
  const link = await createLinkRecord(database(), {
    teamId,
    uid: request.auth.uid,
    slug,
    destinationUrl,
    now: Timestamp.now(),
  });
  return {
    link: {
      slug,
      teamId: link.teamId,
      createdBy: link.createdBy,
      destinationUrl: link.destinationUrl,
      status: link.status,
      totalClicks: link.totalClicks,
      createdAt: link.createdAt.toDate().toISOString(),
      updatedAt: link.updatedAt.toDate().toISOString(),
    },
  };
});

function requireGoogleUser(request: {
  readonly auth?: { readonly uid: string; readonly token: Record<string, unknown> };
}): string {
  if (request.auth === undefined || !isGoogleAuthToken(request.auth.token)) {
    throw new HttpsError('unauthenticated', 'Uma sessão Google válida é obrigatória.');
  }
  return request.auth.uid;
}

function callableLink(link: LinkDocument, slug: string) {
  return {
    slug,
    teamId: link.teamId,
    createdBy: link.createdBy,
    destinationUrl: link.destinationUrl,
    status: link.status,
    totalClicks: link.totalClicks,
    createdAt: link.createdAt.toDate().toISOString(),
    updatedAt: link.updatedAt.toDate().toISOString(),
  };
}

export const updateLinkDestination = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireGoogleUser(request);
  const data = request.data as Record<string, unknown> | null;
  const teamId = readTeamId(data?.['teamId']);
  const slug = normalizeLinkSlug(data?.['slug']);
  const result = await updateLinkRecord(database(), {
    teamId,
    uid,
    slug,
    now: Timestamp.now(),
    change: {
      type: 'destination',
      destinationUrl: normalizeDestinationUrl(data?.['destinationUrl']),
    },
  });
  return { changed: result.changed, link: callableLink(result.link, slug) };
});

export const changeLinkStatus = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireGoogleUser(request);
  const data = request.data as Record<string, unknown> | null;
  const command = data?.['command'];
  if (command !== 'disable' && command !== 'archive' && command !== 'restore') {
    throw new HttpsError('invalid-argument', 'A alteração de estado é inválida.', {
      field: 'status',
    });
  }
  const teamId = readTeamId(data?.['teamId']);
  const slug = normalizeLinkSlug(data?.['slug']);
  const result = await updateLinkRecord(database(), {
    teamId,
    uid,
    slug,
    now: Timestamp.now(),
    change: { type: 'status', command },
  });
  return { changed: result.changed, link: callableLink(result.link, slug) };
});
