import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthFailure, AuthState } from '../model/session';
import { createFirebaseAuthService, type AuthService } from '../services/authService';
import { AuthContext, type AuthContextValue } from './authContext';

const INITIAL_STATE: AuthState = { status: 'initializing', user: null, error: null };
const defaultService = createFirebaseAuthService();

export function AuthProvider({
  children,
  service = defaultService,
}: {
  readonly children: ReactNode;
  readonly service?: AuthService;
}) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const unsubscribe = service.subscribe(
      (user) => {
        revision += 1;
        const currentRevision = revision;
        if (user === null) {
          setState({ status: 'unauthenticated', user: null, error: null });
          return;
        }

        setState({ status: 'authenticating', user: null, error: null });
        void service
          .ensureProfile()
          .then(() => {
            if (active && currentRevision === revision) {
              setState({ status: 'authenticated', user, error: null });
            }
          })
          .catch(() => {
            if (active && currentRevision === revision) {
              const failure: AuthFailure = {
                code: 'auth/profile',
                message:
                  'Seu acesso foi confirmado, mas o perfil não pôde ser preparado. Tente novamente.',
              };
              setState({ status: 'error', user: null, error: failure });
            }
          });
      },
      (failure) => {
        if (active) setState({ status: 'error', user: null, error: failure });
      },
    );

    return () => {
      active = false;
      revision += 1;
      unsubscribe();
    };
  }, [service]);

  const signIn = useCallback(
    async (returnPath: string) => {
      setState({ status: 'authenticating', user: null, error: null });
      try {
        const failure = await service.startGoogleSignIn(returnPath);
        if (failure !== null) setState({ status: 'error', user: null, error: failure });
      } catch {
        setState({
          status: 'error',
          user: null,
          error: {
            code: 'auth/provider',
            message: 'O Google não concluiu a autenticação. Tente novamente.',
          },
        });
      }
    },
    [service],
  );

  const signInWithCredential = useCallback(
    async (idToken: string, returnPath: string) => {
      setState({ status: 'authenticating', user: null, error: null });
      try {
        const failure = await (service.signInWithCredential?.(idToken, returnPath) ?? null);
        if (failure !== null) setState({ status: 'error', user: null, error: failure });
      } catch {
        setState({
          status: 'error',
          user: null,
          error: {
            code: 'auth/provider',
            message: 'O Google não concluiu a autenticação. Tente novamente.',
          },
        });
      }
    },
    [service],
  );

  const initializeOneTap = useCallback(
    (returnPath: string) => {
      return (
        service.initializeGoogleOneTap?.({
          returnPath,
          onCredential: async (idToken: string) => {
            await signInWithCredential(idToken, returnPath);
          },
        }) ?? (() => undefined)
      );
    },
    [service, signInWithCredential],
  );

  const leave = useCallback(async () => {
    setState({ status: 'unauthenticated', user: null, error: null });
    try {
      const failure = await service.signOut();
      if (failure !== null) setState({ status: 'error', user: null, error: failure });
    } catch {
      setState({
        status: 'error',
        user: null,
        error: {
          code: 'auth/logout',
          message: 'A sessão foi ocultada neste dispositivo, mas o Google não confirmou a saída.',
        },
      });
    }
  }, [service]);

  const takeReturnPath = useCallback(() => service.takeReturnPath(), [service]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signInWithCredential,
      initializeOneTap,
      signOut: leave,
      takeReturnPath,
    }),
    [initializeOneTap, leave, signIn, signInWithCredential, state, takeReturnPath],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
