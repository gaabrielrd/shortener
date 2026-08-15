import { createContext, useContext } from 'react';
import type { CreateTeamResult, TeamsState } from '../model/team';

export interface TeamsContextValue extends TeamsState {
  readonly createTeam: (name: string) => Promise<CreateTeamResult>;
  readonly selectTeam: (teamId: string) => boolean;
  readonly retry: () => void;
}

export const TeamsContext = createContext<TeamsContextValue | null>(null);

export function useTeams(): TeamsContextValue {
  const value = useContext(TeamsContext);
  if (value === null) throw new Error('useTeams deve ser usado dentro de TeamsProvider.');
  return value;
}
