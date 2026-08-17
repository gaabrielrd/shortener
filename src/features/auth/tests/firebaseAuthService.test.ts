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
    static credential = vi.fn((token: string) => ({ providerId: 'google.com', token }));
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
    signInWithCredential: vi.fn(() => Promise.resolve()),
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
  signInWithCredential: sdk.signInWithCredential,
  signOut: sdk.firebaseSignOut,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: sdk.httpsCallable }));

function assertDefined<T>(val: T | undefined | null): asserts val is NonNullable<T> {
  if (val === undefined || val === null) throw new Error('Expected value to be defined');
}

describe('Firebase Auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    const script = document.getElementById('google-identity-services-script');
    if (script) script.remove();
    delete (window as unknown as { google?: unknown }).google;
    sdk.signInWithPopup.mockResolvedValue(undefined);
    sdk.signInWithCredential.mockResolvedValue(undefined);
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

  it('autentica via credencial ID Token e preserva a rota de retorno', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const service = createFirebaseAuthService();

    assertDefined(service.signInWithCredential);
    expect(await service.signInWithCredential('test-id-token', '/app/links')).toBeNull();
    expect(service.takeReturnPath()).toBe('/app/links');
    expect(sdk.GoogleAuthProvider.credential).toHaveBeenCalledWith('test-id-token');
    expect(sdk.signInWithCredential).toHaveBeenCalledWith(
      sdk.auth,
      expect.objectContaining({ providerId: 'google.com', token: 'test-id-token' }),
    );
  });

  it('ignora One Tap quando nenhum clientId é fornecido', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const service = createFirebaseAuthService(undefined);
    assertDefined(service.initializeGoogleOneTap);
    const cleanup = service.initializeGoogleOneTap({
      returnPath: '/app',
      onCredential: vi.fn(),
    });
    expect(cleanup).toBeTypeOf('function');
    cleanup();
  });

  it('injeta o script do GIS no DOM e inicializa quando carregado', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const service = createFirebaseAuthService('test-client-id');
    const initialize = vi.fn();
    const prompt = vi.fn();
    const cancel = vi.fn();

    assertDefined(service.initializeGoogleOneTap);
    const cleanup = service.initializeGoogleOneTap({
      returnPath: '/app',
      onCredential: vi.fn(),
    });

    const script = document.getElementById('google-identity-services-script') as HTMLScriptElement;
    expect(script).toBeInTheDocument();

    (window as unknown as { google?: unknown }).google = {
      accounts: {
        id: { initialize, prompt, cancel },
      },
    };

    script.dispatchEvent(new Event('load'));
    await Promise.resolve();
    await Promise.resolve();

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id' }),
    );
    expect(prompt).toHaveBeenCalledOnce();

    cleanup();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('trata carregamento de script existente ou erro de carregamento silenciosamente', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const service = createFirebaseAuthService('test-client-id');

    // Cria script existente
    const script = document.createElement('script');
    script.id = 'google-identity-services-script';
    document.head.appendChild(script);

    assertDefined(service.initializeGoogleOneTap);
    service.initializeGoogleOneTap({
      returnPath: '/app',
      onCredential: vi.fn(),
    });

    // Dispara erro no script existente
    script.dispatchEvent(new Event('error'));
    await Promise.resolve();
  });

  it('inicializa e cancela o Google One Tap quando o cliente está configurado', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const service = createFirebaseAuthService('test-google-client-id');
    const cancel = vi.fn();
    const initialize = vi.fn();
    const prompt = vi.fn();

    // Simula window.google com GIS já disponível
    (window as unknown as { google?: unknown }).google = {
      accounts: {
        id: {
          initialize,
          prompt,
          cancel,
        },
      },
    };

    const onCredential = vi.fn(() => Promise.resolve());
    assertDefined(service.initializeGoogleOneTap);
    const cleanup = service.initializeGoogleOneTap({
      clientId: 'test-google-client-id',
      returnPath: '/app',
      onCredential,
    });

    await Promise.resolve();

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'test-google-client-id',
        auto_select: false,
        cancel_on_tap_outside: true,
      }),
    );
    expect(prompt).toHaveBeenCalledOnce();

    const config = initialize.mock.calls[0]?.[0] as {
      callback: (resp: { credential: string }) => void;
    };
    config.callback({ credential: 'mock-jwt-token' });
    expect(onCredential).toHaveBeenCalledWith('mock-jwt-token');

    cleanup();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('devolve falhas recuperáveis de login e logout', async () => {
    const { createFirebaseAuthService } = await import('../services/authService');
    const service = createFirebaseAuthService();
    sdk.signInWithPopup.mockRejectedValueOnce(
      new FirebaseError('auth/network-request-failed', 'offline'),
    );
    sdk.signInWithCredential.mockRejectedValueOnce(
      new FirebaseError('auth/invalid-credential', 'invalid token'),
    );
    sdk.firebaseSignOut.mockRejectedValueOnce(new Error('offline'));

    expect(await service.startGoogleSignIn('//external.example')).toEqual(
      expect.objectContaining({ code: 'auth/network' }),
    );
    expect(service.takeReturnPath()).toBe('/app');

    assertDefined(service.signInWithCredential);
    expect(await service.signInWithCredential('bad-token', '/app')).toEqual(
      expect.objectContaining({ code: 'auth/provider' }),
    );

    expect(await service.signOut()).toEqual(expect.objectContaining({ code: 'auth/logout' }));
  });
});
