import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const firestore = { type: 'firestore' };
  const functions = { type: 'functions' };
  const unsubscribe = vi.fn();
  let snapshotListener:
    ((snapshot: { docs: Array<{ id: string; data(): unknown }> }) => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  const callable = vi.fn(() => Promise.resolve({ data: { ok: true } }));

  return {
    firestore,
    functions,
    unsubscribe,
    collection: vi.fn(() => ({ kind: 'members' })),
    query: vi.fn(() => ({ kind: 'query' })),
    onSnapshot: vi.fn(
      (
        _query: unknown,
        onSnapshot: (snapshot: { docs: Array<{ id: string; data(): unknown }> }) => void,
        onError: (error: Error) => void,
      ) => {
        snapshotListener = onSnapshot;
        errorListener = onError;
        return unsubscribe;
      },
    ),
    httpsCallable: vi.fn(() => callable),
    callable,
    getFirebaseServices: vi.fn(() => ({ firestore, functions })),
    emitMembers(values: readonly { id: string; data: unknown }[]) {
      snapshotListener?.({
        docs: values.map((value) => ({ id: value.id, data: () => value.data })),
      });
    },
    emitError(error: Error) {
      errorListener?.(error);
    },
  };
});

vi.mock('@/shared/services/firebase', () => ({
  getFirebaseServices: sdk.getFirebaseServices,
}));
vi.mock('firebase/firestore', () => ({
  collection: sdk.collection,
  onSnapshot: sdk.onSnapshot,
  query: sdk.query,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: sdk.httpsCallable }));

describe('Firebase Members service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.callable.mockResolvedValue({ data: { ok: true } });
  });

  it('acompanha e ordena os membros da equipe', async () => {
    const { createFirebaseMembersService } = await import('../services/membersService');
    const onMembers = vi.fn();
    const onError = vi.fn();

    const unsubscribe = createFirebaseMembersService().subscribe('team-1', onMembers, onError);
    sdk.emitMembers([
      {
        id: 'user-2',
        data: {
          uid: 'user-2',
          displayName: 'Zulu',
          email: 'zulu@example.test',
          role: 'member',
        },
      },
      {
        id: 'user-1',
        data: {
          uid: 'user-1',
          displayName: 'Ana',
          email: 'ana@example.test',
          role: 'admin',
        },
      },
    ]);

    expect(sdk.collection).toHaveBeenCalledWith(sdk.firestore, 'teams', 'team-1', 'members');
    expect(onMembers).toHaveBeenCalledWith([
      {
        uid: 'user-1',
        displayName: 'Ana',
        email: 'ana@example.test',
        role: 'admin',
      },
      {
        uid: 'user-2',
        displayName: 'Zulu',
        email: 'zulu@example.test',
        role: 'member',
      },
    ]);
    expect(onError).not.toHaveBeenCalled();
    unsubscribe();
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });

  it('rejeita documento inválido e traduz acesso negado', async () => {
    const { createFirebaseMembersService } = await import('../services/membersService');
    const onError = vi.fn();
    createFirebaseMembersService().subscribe('team-1', vi.fn(), onError);

    sdk.emitMembers([
      {
        id: 'user-1',
        data: { uid: 'outro', displayName: 'Ana', email: 'ana@example.test', role: 'admin' },
      },
    ]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'members/unknown' }));

    sdk.emitError(new FirebaseError('permission-denied', 'denied'));
    expect(onError).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: 'members/forbidden' }),
    );
  });

  it('executa a Function e preserva a proteção do último administrador', async () => {
    const { createFirebaseMembersService } = await import('../services/membersService');
    const service = createFirebaseMembersService();
    const command = {
      action: 'change-role' as const,
      teamId: 'team-1',
      targetUid: 'user-2',
      role: 'admin' as const,
    };

    await expect(service.execute(command)).resolves.toEqual({ ok: true });
    expect(sdk.httpsCallable).toHaveBeenCalledWith(sdk.functions, 'updateMembership');
    expect(sdk.callable).toHaveBeenCalledWith(command);

    const lastAdminError = Object.assign(
      new FirebaseError('functions/failed-precondition', 'last admin'),
      { details: { reason: 'last-admin' } },
    );
    sdk.callable.mockRejectedValueOnce(lastAdminError);

    await expect(service.execute(command)).resolves.toEqual({
      ok: false,
      failure: {
        code: 'members/last-admin',
        message: 'Promova outro membro antes de remover ou rebaixar o último administrador.',
      },
    });
  });
});
