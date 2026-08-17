import { createContext, useContext } from 'react';
import type { AuthState } from '../model/session';

export interface AuthContextValue extends AuthState {
  readonly signIn: (returnPath: string) => Promise<void>;
  readonly signInWithCredential: (idToken: string, returnPath: string) => Promise<void>;
  readonly initializeOneTap: (returnPath: string) => () => void;
  readonly signOut: () => Promise<void>;
  readonly takeReturnPath: () => string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return value;
}
