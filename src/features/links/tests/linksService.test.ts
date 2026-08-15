import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const firestore = { type: 'firestore' };
  const functions = { type: 'functions' };
  const unsubscribe = vi.fn();
  let listener: ((snapshot: { docs: Array<{ id: string; data(): unknown }> }) => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  const callable = vi.fn<(input?: unknown) => Promise<{ data: unknown }>>();
  return {
    firestore,
    functions,
    unsubscribe,
    collection: vi.fn(() => ({ kind: 'collection' })),
    where: vi.fn((...parts: unknown[]) => ({ kind: 'where', parts })),
    orderBy: vi.fn((...parts: unknown[]) => ({ kind: 'orderBy', parts })),
    documentId: vi.fn(() => '__name__'),
    limit: vi.fn((value: number) => ({ kind: 'limit', value })),
    startAfter: vi.fn((...parts: unknown[]) => ({ kind: 'startAfter', parts })),
    getDocs: vi.fn<
      (...args: unknown[]) => Promise<{
        docs: Array<{ id: string; data(): unknown }>;
        size: number;
      }>
    >(() => Promise.resolve({ docs: [], size: 0 })),
    query: vi.fn(() => ({ kind: 'query' })),
    onSnapshot: vi.fn(
      (
        _query: unknown,
        onSnapshot: (snapshot: { docs: Array<{ id: string; data(): unknown }> }) => void,
        onError: (error: Error) => void,
      ) => {
        listener = onSnapshot;
        errorListener = onError;
        return unsubscribe;
      },
    ),
    httpsCallable: vi.fn(() => callable),
    callable,
    getFirebaseServices: vi.fn(() => ({ firestore, functions })),
    emit(values: readonly { id: string; data: unknown }[]) {
      listener?.({ docs: values.map((value) => ({ id: value.id, data: () => value.data })) });
    },
    emitError(error: Error) {
      errorListener?.(error);
    },
  };
});

vi.mock('@/shared/config', () => ({ env: { publicShortBaseUrl: 'https://go.example.test' } }));
vi.mock('@/shared/services/firebase', () => ({ getFirebaseServices: sdk.getFirebaseServices }));
vi.mock('firebase/firestore', () => ({
  collection: sdk.collection,
  where: sdk.where,
  orderBy: sdk.orderBy,
  documentId: sdk.documentId,
  limit: sdk.limit,
  startAfter: sdk.startAfter,
  getDocs: sdk.getDocs,
  Timestamp: { fromDate: vi.fn((value: Date) => value) },
  query: sdk.query,
  onSnapshot: sdk.onSnapshot,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: sdk.httpsCallable }));

const timestamp = (value: string) => ({ toDate: () => new Date(value) });
const rawLink = {
  teamId: 'team-1',
  createdBy: 'user-1',
  destinationUrl: 'https://example.com/path',
  status: 'active',
  totalClicks: 0,
  createdAt: timestamp('2026-08-15T12:00:00.000Z'),
  updatedAt: timestamp('2026-08-15T12:00:00.000Z'),
};

describe('Firebase Links service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('monta a consulta por papel e converte snapshots válidos', async () => {
    const { createFirebaseLinksService } = await import('../services/linksService');
    const service = createFirebaseLinksService();
    const onLinks = vi.fn();
    const unsubscribe = service.subscribe('team-1', 'member', 'user-1', onLinks, vi.fn());
    expect(sdk.where).toHaveBeenCalledWith('teamId', '==', 'team-1');
    expect(sdk.where).toHaveBeenCalledWith('createdBy', '==', 'user-1');
    expect(sdk.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    sdk.emit([{ id: 'campanha', data: rawLink }]);
    expect(onLinks).toHaveBeenCalledWith([
      expect.objectContaining({ slug: 'campanha', destinationUrl: rawLink.destinationUrl }),
    ]);
    unsubscribe();
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    service.subscribe('team-1', 'admin', 'admin-1', vi.fn(), vi.fn());
    expect(sdk.where).not.toHaveBeenCalledWith('createdBy', '==', 'admin-1');
  });

  it('traduz documento inválido e negação das Rules', async () => {
    const { createFirebaseLinksService } = await import('../services/linksService');
    const onError = vi.fn();
    createFirebaseLinksService().subscribe('team-1', 'admin', 'user-1', vi.fn(), onError);
    sdk.emit([{ id: 'bad', data: { teamId: 10 } }]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'links/unknown' }));
    sdk.emitError(new FirebaseError('permission-denied', 'denied'));
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'links/forbidden' }));
  });

  it('cria via Function, normaliza entrada e mapeia conflito', async () => {
    const { createFirebaseLinksService } = await import('../services/linksService');
    const service = createFirebaseLinksService();
    sdk.callable.mockResolvedValueOnce({
      data: {
        link: {
          ...rawLink,
          slug: 'campanha',
          createdAt: '2026-08-15T12:00:00.000Z',
          updatedAt: '2026-08-15T12:00:00.000Z',
        },
      },
    });
    const created = await service.create('team-1', ' CAMPANHA ', ' https://example.com/path ');
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.link.slug).toBe('campanha');
    expect(sdk.callable).toHaveBeenCalledWith({
      teamId: 'team-1',
      slug: 'campanha',
      destinationUrl: 'https://example.com/path',
    });

    sdk.callable.mockRejectedValueOnce(new FirebaseError('functions/already-exists', 'conflict'));
    const conflict = await service.create('team-1', 'campanha', 'https://example.com');
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.failure).toMatchObject({ code: 'links/conflict', field: 'slug' });
    }
  });

  it('monta a URL pública e isola o Clipboard', async () => {
    const { createFirebaseLinksService } = await import('../services/linksService');
    const service = createFirebaseLinksService();
    expect(service.publicUrl(' CAMPANHA ')).toBe('https://go.example.test/campanha');
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await expect(service.copy('link')).resolves.toBe(true);
    writeText.mockRejectedValueOnce(new Error('blocked'));
    await expect(service.copy('link')).resolves.toBe(false);
  });

  it('edita destino, muda estado e traduz respostas idempotentes', async () => {
    const { createFirebaseLinksService } = await import('../services/linksService');
    const service = createFirebaseLinksService();
    const responseLink = {
      ...rawLink,
      slug: 'campanha',
      createdAt: '2026-08-15T12:00:00.000Z',
      updatedAt: '2026-08-16T12:00:00.000Z',
    };
    sdk.callable.mockResolvedValueOnce({ data: { changed: true, link: responseLink } });
    const edited = await service.updateDestination(
      'team-1',
      'Campanha',
      ' http://example.com/novo ',
    );
    expect(edited).toMatchObject({ ok: true, changed: true });
    expect(sdk.httpsCallable).toHaveBeenLastCalledWith(sdk.functions, 'updateLinkDestination');
    expect(sdk.callable).toHaveBeenLastCalledWith({
      teamId: 'team-1',
      slug: 'campanha',
      destinationUrl: 'http://example.com/novo',
    });

    sdk.callable.mockResolvedValueOnce({ data: { changed: false, link: responseLink } });
    const status = await service.changeStatus('team-1', 'campanha', 'archive');
    expect(status).toMatchObject({ ok: true, changed: false });
    expect(sdk.httpsCallable).toHaveBeenLastCalledWith(sdk.functions, 'changeLinkStatus');
  });

  it('pagina o histórico com cursor estável de data e documento', async () => {
    const { createFirebaseLinksService } = await import('../services/linksService');
    const historyData = (action: string, date: string) => ({
      action,
      actorId: 'user-1',
      previousValue: null,
      nextValue: 'active',
      createdAt: timestamp(date),
    });
    sdk.getDocs.mockResolvedValueOnce({
      size: 11,
      docs: Array.from({ length: 11 }, (_, index) => ({
        id: `event-${index}`,
        data: () => historyData(index === 0 ? 'restored' : 'created', `2026-08-${15 - index}`),
      })),
    });
    const service = createFirebaseLinksService();
    const first = await service.loadHistory('Campanha');
    expect(first.entries).toHaveLength(10);
    expect(first.nextCursor?.id).toBe('event-9');
    expect(sdk.limit).toHaveBeenCalledWith(11);

    sdk.getDocs.mockResolvedValueOnce({ size: 0, docs: [] });
    await service.loadHistory('campanha', first.nextCursor ?? undefined);
    expect(sdk.startAfter).toHaveBeenCalledWith(expect.any(Date), 'event-9');
  });
});
