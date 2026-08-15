import { describe, expect, it } from 'vitest';
import { EnvValidationError, createEnv } from '../env';

function raw(overrides: Record<string, unknown> = {}): ImportMetaEnv {
  return {
    MODE: 'test',
    PROD: false,
    DEV: true,
    SSR: false,
    BASE_URL: '/',
    VITE_FIREBASE_API_KEY: 'test-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'demo-shortener.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'demo-shortener',
    VITE_FIREBASE_STORAGE_BUCKET: 'demo-shortener.firebasestorage.app',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
    VITE_FIREBASE_APP_ID: '1:000000000000:web:test',
    VITE_PUBLIC_SHORT_BASE_URL: 'https://go.example.test/',
    ...overrides,
  };
}

describe('createEnv', () => {
  it('expoe o modo e a flag de producao', () => {
    const env = createEnv(raw({ MODE: 'production', PROD: true }));

    expect(env.mode).toBe('production');
    expect(env.isProduction).toBe(true);
  });

  it('deixa apiUrl indefinida quando a variavel nao existe', () => {
    expect(createEnv(raw()).apiUrl).toBeUndefined();
  });

  it('trata string vazia ou so espacos como ausente', () => {
    expect(createEnv(raw({ VITE_API_URL: '   ' })).apiUrl).toBeUndefined();
  });

  it('normaliza a URL informada removendo a barra final', () => {
    expect(createEnv(raw({ VITE_API_URL: 'https://api.exemplo.com/' })).apiUrl).toBe(
      'https://api.exemplo.com',
    );
  });

  it('falha com mensagem acionavel quando a URL e invalida', () => {
    expect(() => createEnv(raw({ VITE_API_URL: 'api.exemplo.com' }))).toThrow(EnvValidationError);
    expect(() => createEnv(raw({ VITE_API_URL: 'api.exemplo.com' }))).toThrow(/URL absoluta/);
  });

  it('reune todos os problemas em uma unica mensagem', () => {
    try {
      createEnv(raw({ VITE_API_URL: 'nao-e-url' }));
      expect.unreachable('createEnv deveria ter lancado');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).toContain('.env.local');
    }
  });

  it('expoe a configuracao publica do Firebase', () => {
    const result = createEnv(
      raw({ VITE_FIREBASE_MEASUREMENT_ID: 'G-TEST', VITE_FIREBASE_USE_EMULATORS: 'true' }),
    );

    expect(result.firebase).toEqual({
      apiKey: 'test-api-key',
      authDomain: 'demo-shortener.firebaseapp.com',
      projectId: 'demo-shortener',
      storageBucket: 'demo-shortener.firebasestorage.app',
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:test',
      measurementId: 'G-TEST',
      useEmulators: true,
    });
  });

  it('normaliza a origem pública dos links curtos', () => {
    expect(createEnv(raw()).publicShortBaseUrl).toBe('https://go.example.test');
  });

  it('exige uma origem pública HTTP ou HTTPS', () => {
    expect(() => createEnv(raw({ VITE_PUBLIC_SHORT_BASE_URL: 'ftp://go.example.test' }))).toThrow(
      /http:\/\/ ou https:\/\//,
    );
    expect(() => createEnv(raw({ VITE_PUBLIC_SHORT_BASE_URL: '   ' }))).toThrow(
      /VITE_PUBLIC_SHORT_BASE_URL e obrigatoria/,
    );
  });

  it('falha no boot quando uma variavel obrigatoria do Firebase esta ausente', () => {
    expect(() => createEnv(raw({ VITE_FIREBASE_PROJECT_ID: '   ' }))).toThrow(
      /VITE_FIREBASE_PROJECT_ID e obrigatoria/,
    );
  });

  it('rejeita uma flag de emulador ambigua', () => {
    expect(() => createEnv(raw({ VITE_FIREBASE_USE_EMULATORS: 'sim' }))).toThrow(
      /deve ser "true" ou "false"/,
    );
  });
});
