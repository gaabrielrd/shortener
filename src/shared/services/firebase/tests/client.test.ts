import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const app = { name: '[DEFAULT]' };
  const auth = { name: 'auth' };
  const firestore = { name: 'firestore' };
  const functions = { name: 'functions' };

  return {
    app,
    auth,
    firestore,
    functions,
    getApp: vi.fn(() => app),
    getApps: vi.fn((): unknown[] => []),
    initializeApp: vi.fn(() => app),
    getAuth: vi.fn(() => auth),
    connectAuthEmulator: vi.fn(),
    getFirestore: vi.fn(() => firestore),
    connectFirestoreEmulator: vi.fn(),
    getFunctions: vi.fn(() => functions),
    connectFunctionsEmulator: vi.fn(),
  };
});

vi.mock('firebase/app', () => ({
  getApp: sdk.getApp,
  getApps: sdk.getApps,
  initializeApp: sdk.initializeApp,
}));
vi.mock('firebase/auth', () => ({
  getAuth: sdk.getAuth,
  connectAuthEmulator: sdk.connectAuthEmulator,
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: sdk.getFirestore,
  connectFirestoreEmulator: sdk.connectFirestoreEmulator,
}));
vi.mock('firebase/functions', () => ({
  getFunctions: sdk.getFunctions,
  connectFunctionsEmulator: sdk.connectFunctionsEmulator,
}));

describe('getFirebaseServices', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sdk.getApps.mockReturnValue([]);
  });

  it('inicializa uma vez e conecta todos os SDKs aos emuladores', async () => {
    const { getFirebaseServices } = await import('../client');

    const first = getFirebaseServices();
    const second = getFirebaseServices();

    expect(second).toBe(first);
    expect(first).toEqual({
      app: sdk.app,
      auth: sdk.auth,
      firestore: sdk.firestore,
      functions: sdk.functions,
    });
    expect(sdk.initializeApp).toHaveBeenCalledOnce();
    expect(sdk.getFunctions).toHaveBeenCalledWith(sdk.app, 'southamerica-east1');
    expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(sdk.auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledWith(sdk.firestore, '127.0.0.1', 8080);
    expect(sdk.connectFunctionsEmulator).toHaveBeenCalledWith(sdk.functions, '127.0.0.1', 5001);
  });

  it('reaproveita um app existente sem reconectar emuladores durante HMR', async () => {
    sdk.getApps.mockReturnValue([sdk.app]);
    const { getFirebaseServices } = await import('../client');

    getFirebaseServices();

    expect(sdk.getApp).toHaveBeenCalledOnce();
    expect(sdk.initializeApp).not.toHaveBeenCalled();
    expect(sdk.connectAuthEmulator).not.toHaveBeenCalled();
    expect(sdk.connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(sdk.connectFunctionsEmulator).not.toHaveBeenCalled();
  });
});
