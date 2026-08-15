import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth';
import type { CreateTeamResult, Team, TeamsState } from '../model/team';
import { createFirebaseTeamsService, type TeamsService } from '../services/teamsService';
import { TeamsContext, type TeamsContextValue } from './teamsContext';

const INITIAL_STATE: TeamsState = {
  status: 'idle',
  teams: [],
  activeTeam: null,
  error: null,
  isCreating: false,
};
const LOADING_STATE: TeamsState = { ...INITIAL_STATE, status: 'loading' };
const defaultService = createFirebaseTeamsService();

interface UserTeamsSnapshot {
  readonly session: symbol | null;
  readonly state: TeamsState;
}

export function TeamsProvider({
  children,
  service = defaultService,
}: {
  readonly children: ReactNode;
  readonly service?: TeamsService;
}) {
  const auth = useAuth();
  const uid = auth.status === 'authenticated' ? auth.user?.uid : undefined;
  const session = useMemo(() => (uid === undefined ? null : Symbol(uid)), [uid]);
  const [snapshot, setSnapshot] = useState<UserTeamsSnapshot>({
    session: null,
    state: INITIAL_STATE,
  });
  const [reload, setReload] = useState(0);
  const state =
    session === null
      ? INITIAL_STATE
      : snapshot.session === session
        ? snapshot.state
        : LOADING_STATE;

  useEffect(() => {
    if (uid === undefined) return;
    return service.subscribe(
      uid,
      (teams) => {
        setSnapshot((current) => {
          const previous = current.session === session ? current.state : LOADING_STATE;
          const activeTeam =
            teams.find((team) => team.id === previous.activeTeam?.id) ?? teams[0] ?? null;
          return {
            session,
            state: {
              status: teams.length === 0 ? 'empty' : 'ready',
              teams,
              activeTeam,
              error: null,
              isCreating: previous.isCreating,
            },
          };
        });
      },
      (error) => {
        setSnapshot((current) => ({
          session,
          state: {
            ...(current.session === session ? current.state : LOADING_STATE),
            status: 'error',
            error,
            isCreating: false,
          },
        }));
      },
    );
  }, [reload, service, session, uid]);

  const createTeam = useCallback(
    async (name: string): Promise<CreateTeamResult> => {
      if (uid === undefined) {
        return {
          ok: false,
          failure: {
            code: 'teams/unauthenticated',
            message: 'Entre com Google para acessar suas equipes.',
          },
        };
      }
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          isCreating: true,
          error: null,
        },
      }));
      const result = await service.createTeam(name);
      setSnapshot((current) => {
        const previous = current.session === session ? current.state : LOADING_STATE;
        if (!result.ok) return { session, state: { ...previous, isCreating: false } };
        const teams = [
          ...previous.teams.filter((team) => team.id !== result.team.id),
          result.team,
        ].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
        return {
          session,
          state: {
            status: 'ready',
            teams,
            activeTeam: result.team,
            error: null,
            isCreating: false,
          },
        };
      });
      return result;
    },
    [service, session, uid],
  );

  const selectTeam = useCallback(
    (teamId: string): boolean => {
      if (uid === undefined) return false;
      const activeTeam: Team | undefined = state.teams.find((team) => team.id === teamId);
      if (activeTeam === undefined) return false;
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : state),
          activeTeam,
        },
      }));
      return true;
    },
    [session, state, uid],
  );

  const retry = useCallback(() => {
    if (uid === undefined) return;
    setSnapshot({ session, state: LOADING_STATE });
    setReload((value) => value + 1);
  }, [session, uid]);
  const value = useMemo<TeamsContextValue>(
    () => ({ ...state, createTeam, selectTeam, retry }),
    [createTeam, retry, selectTeam, state],
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}
