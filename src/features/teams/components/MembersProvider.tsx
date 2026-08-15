import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth';
import type { MemberOperationResult, MembersState } from '../model/member';
import type { TeamRole } from '../model/team';
import { createFirebaseMembersService, type MembersService } from '../services/membersService';
import { MembersContext, type MembersContextValue } from './membersContext';
import { useTeams } from './teamsContext';

const INITIAL_STATE: MembersState = {
  status: 'idle',
  members: [],
  error: null,
  operatingUid: null,
  feedback: null,
};
const LOADING_STATE: MembersState = { ...INITIAL_STATE, status: 'loading' };
const defaultService = createFirebaseMembersService();

export function MembersProvider({
  children,
  service = defaultService,
}: {
  readonly children: ReactNode;
  readonly service?: MembersService;
}) {
  const auth = useAuth();
  const teams = useTeams();
  const uid = auth.status === 'authenticated' ? auth.user?.uid : undefined;
  const teamId = teams.activeTeam?.id;
  const session = useMemo(
    () => (uid === undefined || teamId === undefined ? null : Symbol(`${uid}:${teamId}`)),
    [teamId, uid],
  );
  const [snapshot, setSnapshot] = useState<{ session: symbol | null; state: MembersState }>({
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
    if (session === null || teamId === undefined) return;
    return service.subscribe(
      teamId,
      (members) =>
        setSnapshot((current) => ({
          session,
          state: {
            ...(current.session === session ? current.state : LOADING_STATE),
            status: members.length === 0 ? 'empty' : 'ready',
            members,
            error: null,
          },
        })),
      (error) =>
        setSnapshot((current) => ({
          session,
          state: {
            ...(current.session === session ? current.state : LOADING_STATE),
            status: 'error',
            error,
          },
        })),
    );
  }, [reload, service, session, teamId]);

  const execute = useCallback(
    async (
      operatingUid: string,
      command:
        | { action: 'change-role'; targetUid: string; role: TeamRole }
        | { action: 'remove'; targetUid: string }
        | { action: 'leave' },
      feedback: string,
    ): Promise<MemberOperationResult> => {
      if (session === null || teamId === undefined) {
        return {
          ok: false,
          failure: { code: 'members/forbidden', message: 'Nenhuma equipe está ativa.' },
        };
      }
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          operatingUid,
          feedback: null,
          error: null,
        },
      }));
      const result = await service.execute({ ...command, teamId });
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          operatingUid: null,
          feedback: result.ok ? feedback : null,
          error: result.ok ? null : result.failure,
        },
      }));
      return result;
    },
    [service, session, teamId],
  );

  const changeRole = useCallback(
    (targetUid: string, role: TeamRole) =>
      execute(
        targetUid,
        { action: 'change-role', targetUid, role },
        role === 'admin'
          ? 'Membro promovido a administrador.'
          : 'Administrador alterado para membro.',
      ),
    [execute],
  );
  const removeMember = useCallback(
    (targetUid: string) => execute(targetUid, { action: 'remove', targetUid }, 'Membro removido.'),
    [execute],
  );
  const leaveTeam = useCallback(
    () => execute(uid ?? '', { action: 'leave' }, 'Você saiu da equipe.'),
    [execute, uid],
  );
  const clearFeedback = useCallback(
    () =>
      setSnapshot((current) => ({
        ...current,
        state: { ...current.state, feedback: null, error: null },
      })),
    [],
  );
  const retry = useCallback(() => {
    if (session === null) return;
    setSnapshot({ session, state: LOADING_STATE });
    setReload((value) => value + 1);
  }, [session]);
  const value = useMemo<MembersContextValue>(
    () => ({ ...state, changeRole, removeMember, leaveTeam, clearFeedback, retry }),
    [changeRole, clearFeedback, leaveTeam, removeMember, retry, state],
  );

  return <MembersContext.Provider value={value}>{children}</MembersContext.Provider>;
}
