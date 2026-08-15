export type TeamRole = 'admin' | 'member';

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly role: TeamRole;
}

export type TeamFailureCode =
  | 'teams/name-required'
  | 'teams/name-too-long'
  | 'teams/unauthenticated'
  | 'teams/forbidden'
  | 'teams/conflict'
  | 'teams/unavailable'
  | 'teams/unknown';

export interface TeamFailure {
  readonly code: TeamFailureCode;
  readonly message: string;
  readonly field?: 'name';
}

export type CreateTeamResult =
  | { readonly ok: true; readonly team: Team }
  | { readonly ok: false; readonly failure: TeamFailure };

export type TeamsStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error';

export interface TeamsState {
  readonly status: TeamsStatus;
  readonly teams: readonly Team[];
  readonly activeTeam: Team | null;
  readonly error: TeamFailure | null;
  readonly isCreating: boolean;
}

export function validateTeamName(value: string): TeamFailure | null {
  const name = value.trim();
  if (name.length === 0) {
    return { code: 'teams/name-required', message: 'Informe o nome da equipe.', field: 'name' };
  }
  if (name.length > 80) {
    return {
      code: 'teams/name-too-long',
      message: 'O nome da equipe deve ter no máximo 80 caracteres.',
      field: 'name',
    };
  }
  return null;
}
