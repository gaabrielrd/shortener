import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { afterEach, describe, expect, it } from 'vitest';
import { getDefaultAdminApp } from '../src/admin.js';

afterEach(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

describe('getDefaultAdminApp', () => {
  it('inicializa o app padrão mesmo quando o runtime já registrou um app nomeado', () => {
    const namedApp = initializeApp({ projectId: 'demo-shortener' }, 'runtime-named-app');

    const defaultApp = getDefaultAdminApp();

    expect(namedApp.name).toBe('runtime-named-app');
    expect(defaultApp.name).toBe('[DEFAULT]');
    expect(getApps()).toHaveLength(2);
    expect(getDefaultAdminApp()).toBe(defaultApp);
  });
});
