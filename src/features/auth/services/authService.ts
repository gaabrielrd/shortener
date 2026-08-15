import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseServices } from '@/shared/services/firebase';
import type { AuthFailure, AuthUser } from '../model/session';

const RETURN_PATH_KEY = 'shortener.auth.return-path';

export interface AuthService {
  subscribe(
    onUser: (user: AuthUser | null) => void,
    onError: (failure: AuthFailure) => void,
  ): () => void;
  ensureProfile(): Promise<void>;
  startGoogleSignIn(returnPath: string): Promise<AuthFailure | null>;
  signOut(): Promise<AuthFailure | null>;
  takeReturnPath(): string | null;
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

export function createFirebaseAuthService(): AuthService {
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
