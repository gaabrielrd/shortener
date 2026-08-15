import { vi } from 'vitest';
import type { Team, TeamFailure } from '../model/team';
import type { TeamsService } from '../services/teamsService';

export function createFakeTeamsService() {
  let teamsListener: ((teams: readonly Team[]) => void) | undefined;
  let errorListener: ((failure: TeamFailure) => void) | undefined;
  let nextId = 1;

  const subscribe = vi.fn(
    (
      uid: string,
      onTeams: (teams: readonly Team[]) => void,
      onError: (failure: TeamFailure) => void,
    ) => {
      void uid;
      teamsListener = onTeams;
      errorListener = onError;
      return vi.fn();
    },
  );
  const createTeam = vi.fn((name: string) =>
    Promise.resolve({
      ok: true as const,
      team: { id: `team-${nextId++}`, name: name.trim(), role: 'admin' as const },
    }),
  );
  const service: TeamsService = { subscribe, createTeam };

  return {
    service,
    subscribe,
    createTeam,
    emitTeams(teams: readonly Team[]) {
      teamsListener?.(teams);
    },
    emitError(failure: TeamFailure) {
      errorListener?.(failure);
    },
  };
}
