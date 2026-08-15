import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { env } from '../../config/env';

export interface FirebaseServices {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly functions: Functions;
}

let services: FirebaseServices | undefined;
export const FIREBASE_FUNCTIONS_REGION = 'southamerica-east1';

function connectEmulators(result: FirebaseServices): void {
  connectAuthEmulator(result.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(result.firestore, '127.0.0.1', 8080);
  connectFunctionsEmulator(result.functions, '127.0.0.1', 5001);
}

/** Inicializa os SDKs sob demanda e mantém uma única instância durante HMR. */
export function getFirebaseServices(): FirebaseServices {
  if (services !== undefined) return services;

  const appAlreadyExists = getApps().length > 0;
  const app = appAlreadyExists ? getApp() : initializeApp(env.firebase);
  services = {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    functions: getFunctions(app, FIREBASE_FUNCTIONS_REGION),
  };

  if (env.firebase.useEmulators && !appAlreadyExists) connectEmulators(services);

  return services;
}
