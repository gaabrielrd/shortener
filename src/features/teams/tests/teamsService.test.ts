import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const firestore = { type: 'firestore' };
  const functions = { type: 'functions' };
  const unsubscribe = vi.fn();
  const teamData = new Map<string, { name: string }>();
  let snapshotListener: ((snapshot: { docs: Array<{ data(): unknown }> }) => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  const callable = vi.fn(() =>
    Promise.resolve({
      data: { team: { id: 'team-created', name: 'Criada', role: 'admin' } },
    }),
  );

  return {
    firestore,
    functions,
    unsubscribe,
    teamData,
    collectionGroup: vi.fn(() => ({ kind: 'members' })),
    where: vi.fn(() => ({ kind: 'filter' })),
    query: vi.fn(() => ({ kind: 'query' })),
    doc: vi.fn((_firestore: unknown, _collection: string, id: string) => ({ id })),
    getDoc: vi.fn((reference: { id: string }) =>
      Promise.resolve({
        exists: () => teamData.has(reference.id),
        data: () => teamData.get(reference.id),
      }),
    ),
    onSnapshot: vi.fn(
      (
        _query: unknown,
        onSnapshot: (snapshot: { docs: Array<{ data(): unknown }> }) => void,
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
    emitMemberships(values: readonly unknown[]) {
      snapshotListener?.({ docs: values.map((value) => ({ data: () => value })) });
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
  collectionGroup: sdk.collectionGroup,
  doc: sdk.doc,
  getDoc: sdk.getDoc,
  onSnapshot: sdk.onSnapshot,
  query: sdk.query,
  where: sdk.where,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: sdk.httpsCallable }));

describe('Firebase Teams service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.teamData.clear();
    sdk.callable.mockResolvedValue({
      data: { team: { id: 'team-created', name: 'Criada', role: 'admin' } },
    });
  });

  it('consulta associações do UID, busca as equipes e ordena pelo nome', async () => {
    const { createFirebaseTeamsService } = await import('../services/teamsService');
    const onTeams = vi.fn();
    const onError = vi.fn();
    sdk.teamData.set('team-a', { name: 'Zulu' });
    sdk.teamData.set('team-b', { name: 'Alfa' });

    const unsubscribe = createFirebaseTeamsService().subscribe('user-1', onTeams, onError);
    sdk.emitMemberships([
      { uid: 'user-1', teamId: 'team-a', role: 'admin' },
      { uid: 'user-1', teamId: 'team-b', role: 'member' },
    ]);
    await vi.waitFor(() => expect(onTeams).toHaveBeenCalledOnce());

    expect(sdk.collectionGroup).toHaveBeenCalledWith(sdk.firestore, 'members');
    expect(sdk.where).toHaveBeenCalledWith('uid', '==', 'user-1');
    expect(onTeams).toHaveBeenCalledWith([
      { id: 'team-b', name: 'Alfa', role: 'member' },
      { id: 'team-a', name: 'Zulu', role: 'admin' },
    ]);
    expect(onError).not.toHaveBeenCalled();
    unsubscribe();
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });

  it('não publica associação inválida e traduz acesso negado', async () => {
    const { createFirebaseTeamsService } = await import('../services/teamsService');
    const onError = vi.fn();
    createFirebaseTeamsService().subscribe('user-1', vi.fn(), onError);

    sdk.emitMemberships([{ uid: 'user-1', teamId: 10, role: 'admin' }]);
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'teams/unknown' })),
    );

    sdk.emitError(new FirebaseError('permission-denied', 'denied'));
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'teams/forbidden' }));
  });

  it('cria a equipe pela Function e transforma falha de sessão', async () => {
    const { createFirebaseTeamsService } = await import('../services/teamsService');
    const service = createFirebaseTeamsService();

    expect(await service.createTeam('  Criada  ')).toEqual({
      ok: true,
      team: { id: 'team-created', name: 'Criada', role: 'admin' },
    });
    expect(sdk.httpsCallable).toHaveBeenCalledWith(sdk.functions, 'createTeam');
    expect(sdk.callable).toHaveBeenCalledWith({ name: 'Criada' });

    sdk.callable.mockRejectedValueOnce(new FirebaseError('functions/unauthenticated', 'expired'));
    const failedResult = await service.createTeam('Outra');
    expect(failedResult.ok).toBe(false);
    if (failedResult.ok) throw new Error('A criação deveria falhar.');
    expect(failedResult.failure.code).toBe('teams/unauthenticated');

    sdk.callable.mockRejectedValueOnce(new FirebaseError('functions/already-exists', 'conflict'));
    const conflictResult = await service.createTeam('Outra');
    expect(conflictResult.ok).toBe(false);
    if (conflictResult.ok) throw new Error('A criação em conflito deveria falhar.');
    expect(conflictResult.failure.code).toBe('teams/conflict');
  });
});
