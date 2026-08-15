import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const auth = { currentUser: null };
  const functions = { region: 'local' };
  const unsubscribe = vi.fn();
  const callable = vi.fn(() => Promise.resolve({ data: { uid: 'user-1' } }));
  let userListener: ((user: unknown) => void) | undefined;
  let errorListener: ((error: Error) => void) | undefined;

  class GoogleAuthProvider {
    setCustomParameters = vi.fn();
  }

  return {
    auth,
    functions,
    unsubscribe,
    callable,
    GoogleAuthProvider,
    onAuthStateChanged: vi.fn(
      (_auth: unknown, onUser: (user: unknown) => void, onError: (error: Error) => void) => {
        userListener = onUser;
        errorListener = onError;
        return unsubscribe;
      },
    ),
    signInWithPopup: vi.fn(() => Promise.resolve()),
    firebaseSignOut: vi.fn(() => Promise.resolve()),
    httpsCallable: vi.fn(() => callable),
    getFirebaseServices: vi.fn(() => ({ auth, functions })),
    emitUser(user: unknown) {
      userListener?.(user);
    },
    emitError(error: Error) {
      errorListener?.(error);
    },
  };
});

vi.mock('@/shared/services/firebase', () => ({
  getFirebaseServices: sdk.getFirebaseServices,
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: sdk.GoogleAuthProvider,
  onAuthStateChanged: sdk.onAuthStateChanged,
  signInWithPopup: sdk.signInWithPopup,
  signOut: sdk.firebaseSignOut,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: sdk.httpsCallable }));

describe('Firebase Auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    sdk.signInWithPopup.mockResolvedValue(undefined);
    sdk.firebaseSignOut.mockResolvedValue(undefined);
  });

  it('observa sessão e traduz o usuário para o contrato público', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const onUser = vi.fn();
    const onError = vi.fn();
    const service = createFirebaseAuthService();

    const unsubscribe = service.subscribe(onUser, onError);
    sdk.emitUser({
      uid: 'user-1',
      displayName: ' Ana Silva ',
      email: ' ana@example.com ',
    });
    sdk.emitUser(null);
    sdk.emitError(new FirebaseError('auth/network-request-failed', 'offline'));

    expect(onUser).toHaveBeenNthCalledWith(1, {
      uid: 'user-1',
      displayName: 'Ana Silva',
      email: 'ana@example.com',
    });
    expect(onUser).toHaveBeenNthCalledWith(2, null);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'auth/network' }));
    unsubscribe();
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });

  it('prepara o perfil pela callable Function', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');

    await createFirebaseAuthService().ensureProfile();

    expect(sdk.httpsCallable).toHaveBeenCalledWith(sdk.functions, 'ensureUserProfile');
    expect(sdk.callable).toHaveBeenCalledOnce();
  });

  it('preserva a página e consome a rota ao abrir o popup Google', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const service = createFirebaseAuthService();

    expect(await service.startGoogleSignIn('/app?filtro=meus')).toBeNull();
    expect(service.takeReturnPath()).toBe('/app?filtro=meus');
    expect(service.takeReturnPath()).toBeNull();
    expect(sdk.signInWithPopup).toHaveBeenCalledWith(sdk.auth, expect.any(sdk.GoogleAuthProvider));
  });

  it('devolve falhas recuperáveis de login e logout', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const service = createFirebaseAuthService();
    sdk.signInWithPopup.mockRejectedValueOnce(
      new FirebaseError('auth/network-request-failed', 'offline'),
    );
    sdk.firebaseSignOut.mockRejectedValueOnce(new Error('offline'));

    expect(await service.startGoogleSignIn('//external.example')).toEqual(
      expect.objectContaining({ code: 'auth/network' }),
    );
    expect(service.takeReturnPath()).toBe('/app');
    expect(await service.signOut()).toEqual(expect.objectContaining({ code: 'auth/logout' }));
  });
});
