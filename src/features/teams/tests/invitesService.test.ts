import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamInvite } from '../model/invite';

const sdk = vi.hoisted(() => {
  const firestore = { type: 'firestore' };
  const functions = { type: 'functions' };
  const unsubscribe = vi.fn();
  let listener: ((snapshot: { docs: Array<{ id: string; data(): unknown }> }) => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  const callable = vi.fn<(input?: unknown) => Promise<{ data: unknown }>>(() =>
    Promise.resolve({ data: { ok: true } }),
  );
  return {
    firestore,
    functions,
    unsubscribe,
    collection: vi.fn(() => ({ kind: 'collection' })),
    where: vi.fn(() => ({ kind: 'where' })),
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

vi.mock('@/shared/services/firebase', () => ({ getFirebaseServices: sdk.getFirebaseServices }));
vi.mock('firebase/firestore', () => ({
  collection: sdk.collection,
  where: sdk.where,
  query: sdk.query,
  onSnapshot: sdk.onSnapshot,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: sdk.httpsCallable }));

const timestamp = (value: string) => ({ toDate: () => new Date(value) });

describe('Firebase Invites service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.callable.mockResolvedValue({ data: { ok: true } });
  });

  it('lista metadados da equipe sem token e ordena pelo mais novo', async () => {
    const { createFirebaseInvitesService } = await import('../services/invitesService');
    const onInvites = vi.fn();
    const onError = vi.fn();
    const unsubscribe = createFirebaseInvitesService().subscribe('team-1', onInvites, onError);
    sdk.emit([
      {
        id: 'old',
        data: {
          teamId: 'team-1',
          createdBy: 'u1',
          expiresAt: timestamp('2030-01-01'),
          canceledAt: null,
          createdAt: timestamp('2026-01-01'),
        },
      },
      {
        id: 'new',
        data: {
          teamId: 'team-1',
          createdBy: 'u1',
          expiresAt: timestamp('2030-01-01'),
          canceledAt: timestamp('2027-01-01'),
          createdAt: timestamp('2026-02-01'),
        },
      },
    ]);

    expect(sdk.where).toHaveBeenCalledWith('teamId', '==', 'team-1');
    const published = onInvites.mock.calls[0]?.[0] as readonly TeamInvite[] | undefined;
    expect(published?.map((invite) => invite.id)).toEqual(['new', 'old']);
    expect(JSON.stringify(onInvites.mock.calls[0]?.[0])).not.toContain('token');
    expect(onError).not.toHaveBeenCalled();
    unsubscribe();
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });

  it('traduz documento inválido e negação das Rules', async () => {
    const { createFirebaseInvitesService } = await import('../services/invitesService');
    const onError = vi.fn();
    createFirebaseInvitesService().subscribe('team-1', vi.fn(), onError);
    sdk.emit([{ id: 'bad', data: { teamId: 10 } }]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invites/unknown' }));
    sdk.emitError(new FirebaseError('permission-denied', 'denied'));
    expect(onError).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: 'invites/forbidden' }),
    );
  });

  it('cria, cancela e consome pelas Functions com erros estáveis', async () => {
    const { createFirebaseInvitesService } = await import('../services/invitesService');
    const service = createFirebaseInvitesService();
    const invite = {
      id: 'hash',
      teamId: 'team-1',
      createdBy: 'u1',
      expiresAt: '2030-01-01T00:00:00.000Z',
      canceledAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    sdk.callable.mockResolvedValueOnce({ data: { token: 'secret', invite } });
    await expect(service.create('team-1', invite.expiresAt)).resolves.toEqual({
      ok: true,
      token: 'secret',
      invite,
    });
    expect(sdk.httpsCallable).toHaveBeenLastCalledWith(sdk.functions, 'createInvite');

    sdk.callable.mockResolvedValueOnce({ data: { ok: true } });
    await expect(service.cancel('team-1', 'hash')).resolves.toEqual({ ok: true });
    expect(sdk.httpsCallable).toHaveBeenLastCalledWith(sdk.functions, 'cancelInvite');

    sdk.callable.mockResolvedValueOnce({
      data: { teamId: 'team-1', teamName: 'Equipe', alreadyMember: false },
    });
    await expect(service.consume('secret')).resolves.toEqual({
      ok: true,
      teamId: 'team-1',
      teamName: 'Equipe',
      alreadyMember: false,
    });
    expect(sdk.httpsCallable).toHaveBeenLastCalledWith(sdk.functions, 'consumeInvite');

    const expired = Object.assign(new FirebaseError('functions/failed-precondition', 'expired'), {
      details: { reason: 'expired' },
    });
    sdk.callable.mockRejectedValueOnce(expired);
    await expect(service.consume('secret')).resolves.toEqual({
      ok: false,
      failure: { code: 'invites/expired', message: 'Este convite já venceu.' },
    });
  });

  it('copia pelo adaptador de Clipboard e informa bloqueio do navegador', async () => {
    const { createFirebaseInvitesService } = await import('../services/invitesService');
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const service = createFirebaseInvitesService();

    await expect(service.copy('link')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('link');
    writeText.mockRejectedValueOnce(new Error('blocked'));
    await expect(service.copy('link')).resolves.toBe(false);
  });
});
