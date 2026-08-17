import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential as firebaseSignInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { env } from '@/shared/config/env';
import { getFirebaseServices } from '@/shared/services/firebase';
import type { AuthFailure, AuthUser } from '../model/session';

const RETURN_PATH_KEY = 'shortener.auth.return-path';
const GIS_SCRIPT_ID = 'google-identity-services-script';

export interface OneTapOptions {
  readonly clientId?: string;
  readonly returnPath: string;
  readonly onCredential: (idToken: string) => Promise<void>;
  readonly onError?: (failure: AuthFailure) => void;
}

export interface AuthService {
  readonly subscribe: (
    onUser: (user: AuthUser | null) => void,
    onError: (failure: AuthFailure) => void,
  ) => () => void;
  readonly ensureProfile: () => Promise<void>;
  readonly startGoogleSignIn: (returnPath: string) => Promise<AuthFailure | null>;
  readonly signInWithCredential?: (
    idToken: string,
    returnPath: string,
  ) => Promise<AuthFailure | null>;
  readonly initializeGoogleOneTap?: (options: OneTapOptions) => () => void;
  readonly signOut: () => Promise<AuthFailure | null>;
  readonly takeReturnPath: () => string | null;
}

interface GoogleCredentialResponse {
  readonly credential?: string;
}

interface GoogleIdConfiguration {
  readonly client_id: string;
  readonly callback: (response: GoogleCredentialResponse) => void;
  readonly auto_select?: boolean;
  readonly cancel_on_tap_outside?: boolean;
}

interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void;
  prompt(notificationListener?: (notification: unknown) => void): void;
  cancel(): void;
}

interface WindowWithGoogle extends Window {
  google?: {
    accounts?: {
      id?: GoogleAccountsId;
    };
  };
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || 'Usuário Google',
    email: user.email?.trim() || '',
  };
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return '/app';
  }
  return value;
}

export function toAuthFailure(error: unknown, fallback: AuthFailure['code']): AuthFailure {
  if (!(error instanceof FirebaseError)) {
    return { code: fallback, message: 'Não foi possível concluir o acesso. Tente novamente.' };
  }

  if (error.code === 'auth/popup-closed-by-user') {
    return { code: 'auth/cancelled', message: 'O acesso com Google foi cancelado.' };
  }

  if (error.code === 'auth/network-request-failed') {
    return {
      code: 'auth/network',
      message: 'Não foi possível conectar ao Google. Verifique sua conexão e tente novamente.',
    };
  }

  if (error.code.startsWith('auth/')) {
    return {
      code: 'auth/provider',
      message: 'O Google não concluiu a autenticação. Tente novamente.',
    };
  }

  return { code: fallback, message: 'Não foi possível concluir o acesso. Tente novamente.' };
}

function writeReturnPath(path: string): void {
  try {
    window.sessionStorage.setItem(RETURN_PATH_KEY, safeReturnPath(path));
  } catch {
    // O login ainda funciona; nesse caso a navegação usa o fallback `/app`.
  }
}

function readReturnPath(): string | null {
  try {
    const value = window.sessionStorage.getItem(RETURN_PATH_KEY);
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
    return value === null ? null : safeReturnPath(value);
  } catch {
    return null;
  }
}

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }
  const win = window as unknown as WindowWithGoogle;
  if (win.google?.accounts?.id) {
    return Promise.resolve();
  }
  const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      if (win.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Falha ao carregar script do Google One Tap.')),
        { once: true },
      );
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar script do Google One Tap.'));
    document.head.appendChild(script);
  });
}

export function createFirebaseAuthService(configuredClientId?: string): AuthService {
  return {
    subscribe(onUser, onError) {
      const { auth } = getFirebaseServices();
      return onAuthStateChanged(
        auth,
        (user) => onUser(user === null ? null : toAuthUser(user)),
        (error) => onError(toAuthFailure(error, 'auth/unknown')),
      );
    },

    async ensureProfile() {
      const { functions } = getFirebaseServices();
      const ensureUserProfile = httpsCallable<void, { uid: string }>(
        functions,
        'ensureUserProfile',
      );
      await ensureUserProfile();
    },

    async startGoogleSignIn(returnPath) {
      writeReturnPath(returnPath);
      const { auth } = getFirebaseServices();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
        return null;
      } catch (error) {
        return toAuthFailure(error, 'auth/provider');
      }
    },

    async signInWithCredential(idToken, returnPath) {
      writeReturnPath(returnPath);
      const { auth } = getFirebaseServices();
      const credential = GoogleAuthProvider.credential(idToken);
      try {
        await firebaseSignInWithCredential(auth, credential);
        return null;
      } catch (error) {
        return toAuthFailure(error, 'auth/provider');
      }
    },

    initializeGoogleOneTap(options) {
      const clientId = options.clientId ?? configuredClientId ?? env.googleClientId;
      if (!clientId || typeof window === 'undefined') {
        return () => undefined;
      }

      let cancelled = false;
      const win = window as unknown as WindowWithGoogle;

      void loadGisScript()
        .then(() => {
          if (cancelled) return;
          const googleId = win.google?.accounts?.id;
          if (!googleId) return;

          googleId.initialize({
            client_id: clientId,
            callback: (response) => {
              if (response.credential) {
                void options.onCredential(response.credential);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          googleId.prompt();
        })
        .catch(() => {
          // O carregamento do One Tap falhou de forma não bloqueante.
        });

      return () => {
        cancelled = true;
        try {
          win.google?.accounts?.id?.cancel();
        } catch {
          // Ignora cancelamento quando a API não estiver instanciada.
        }
      };
    },

    async signOut() {
      try {
        await signOut(getFirebaseServices().auth);
        return null;
      } catch (error) {
        return toAuthFailure(error, 'auth/logout');
      }
    },

    takeReturnPath: readReturnPath,
  };
}
