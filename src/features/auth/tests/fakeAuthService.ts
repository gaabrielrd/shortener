import { vi } from 'vitest';
import type { AuthFailure, AuthUser } from '../model/session';
import type { AuthService, OneTapOptions } from '../services/authService';

export function createFakeAuthService() {
  let userListener: ((user: AuthUser | null) => void) | undefined;
  let errorListener: ((failure: AuthFailure) => void) | undefined;
  let oneTapCallback: ((idToken: string) => Promise<void>) | undefined;
  let oneTapErrorCallback: ((failure: AuthFailure) => void) | undefined;
  const cancelOneTap = vi.fn();

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
  const signInWithCredential = vi.fn(
    (idToken: string, returnPath: string): Promise<AuthFailure | null> => {
      void idToken;
      void returnPath;
      return Promise.resolve(null);
    },
  );
  const initializeGoogleOneTap = vi.fn((options: OneTapOptions): (() => void) => {
    oneTapCallback = options.onCredential;
    oneTapErrorCallback = options.onError;
    return cancelOneTap;
  });
  const signOut = vi.fn((): Promise<AuthFailure | null> => Promise.resolve(null));
  const takeReturnPath = vi.fn((): string | null => null);

  const service: AuthService = {
    subscribe,
    ensureProfile,
    startGoogleSignIn,
    signInWithCredential,
    initializeGoogleOneTap,
    signOut,
    takeReturnPath,
  };

  return {
    service,
    ensureProfile,
    startGoogleSignIn,
    signInWithCredential,
    initializeGoogleOneTap,
    cancelOneTap,
    signOut,
    takeReturnPath,
    emitUser(user: AuthUser | null) {
      userListener?.(user);
    },
    emitError(failure: AuthFailure) {
      errorListener?.(failure);
    },
    async triggerOneTapCredential(idToken: string) {
      if (oneTapCallback) {
        await oneTapCallback(idToken);
      }
    },
    triggerOneTapError(failure: AuthFailure) {
      oneTapErrorCallback?.(failure);
    },
  };
}
