import { getApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Obtém especificamente o app Admin padrão.
 *
 * O runtime das Functions pode registrar apps nomeados antes do primeiro handler.
 * Por isso, a quantidade retornada por `getApps()` não indica que `[DEFAULT]`
 * já existe.
 */
export function getDefaultAdminApp(): App {
  try {
    return getApp();
  } catch {
    return initializeApp();
  }
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getDefaultAdminApp());
}
