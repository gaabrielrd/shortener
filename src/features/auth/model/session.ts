export interface AuthUser {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
}

export type AuthStatus =
  'initializing' | 'unauthenticated' | 'authenticating' | 'authenticated' | 'error';

export type AuthErrorCode =
  | 'auth/cancelled'
  | 'auth/network'
  | 'auth/provider'
  | 'auth/profile'
  | 'auth/logout'
  | 'auth/unknown';

export interface AuthFailure {
  readonly code: AuthErrorCode;
  readonly message: string;
}

export interface AuthState {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  readonly error: AuthFailure | null;
}
