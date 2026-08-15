import { vi } from 'vitest';
import type { AuthFailure, AuthUser } from '../model/session';
import type { AuthService } from '../services/authService';

export function createFakeAuthService() {
  let userListener: ((user: AuthUser | null) => void) | undefined;
  let errorListener: ((failure: AuthFailure) => void) | undefined;

  const subscribe = vi.fn(
    (
      onUser: (user: AuthUser | null) => void,
      onError: (failure: AuthFailure) => void,
    ): (() => void) => {
      userListener = onUser;
      errorListener = onError;
      return vi.fn();
    },
  );
  const ensureProfile = vi.fn((): Promise<void> => Promise.resolve());
  const startGoogleSignIn = vi.fn((returnPath: string): Promise<AuthFailure | null> => {
    void returnPath;
    return Promise.resolve(null);
  });
  const signOut = vi.fn((): Promise<AuthFailure | null> => Promise.resolve(null));
  const takeReturnPath = vi.fn((): string | null => null);

  const service: AuthService = {
    subscribe,
    ensureProfile,
    startGoogleSignIn,
    signOut,
    takeReturnPath,
  };

  return {
    service,
    ensureProfile,
    startGoogleSignIn,
    signOut,
    takeReturnPath,
    emitUser(user: AuthUser | null) {
      userListener?.(user);
    },
    emitError(failure: AuthFailure) {
      errorListener?.(failure);
    },
  };
}
