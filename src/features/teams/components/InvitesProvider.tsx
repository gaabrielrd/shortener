import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InvitesState } from '../model/invite';
import { createFirebaseInvitesService, type InvitesService } from '../services/invitesService';
import { InvitesContext, type InvitesContextValue } from './invitesContext';
import { useTeams } from './teamsContext';

const INITIAL_STATE: InvitesState = {
  status: 'idle',
  invites: [],
  error: null,
  isCreating: false,
  cancelingId: null,
};
const LOADING_STATE: InvitesState = { ...INITIAL_STATE, status: 'loading' };
const defaultService = createFirebaseInvitesService();

export function InvitesProvider({
  children,
  service = defaultService,
}: {
  readonly children: ReactNode;
  readonly service?: InvitesService;
}) {
  const teams = useTeams();
  const adminTeamId = teams.activeTeam?.role === 'admin' ? teams.activeTeam.id : undefined;
  const session = useMemo(
    () => (adminTeamId === undefined ? null : Symbol(adminTeamId)),
    [adminTeamId],
  );
  const [snapshot, setSnapshot] = useState<{ session: symbol | null; state: InvitesState }>({
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
    if (session === null || adminTeamId === undefined) return;
    return service.subscribe(
      adminTeamId,
      (invites) =>
        setSnapshot((current) => ({
          session,
          state: {
            ...(current.session === session ? current.state : LOADING_STATE),
            status: invites.length === 0 ? 'empty' : 'ready',
            invites,
            error: null,
          },
        })),
      (error) => setSnapshot({ session, state: { ...LOADING_STATE, status: 'error', error } }),
    );
  }, [adminTeamId, reload, service, session]);

  const create = useCallback(
    async (expiresAt: string) => {
      if (adminTeamId === undefined)
        return {
          ok: false as const,
          failure: {
            code: 'invites/forbidden' as const,
            message: 'Somente administradores criam convites.',
          },
        };
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          isCreating: true,
          error: null,
        },
      }));
      const result = await service.create(adminTeamId, expiresAt);
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          isCreating: false,
          error: result.ok ? null : result.failure,
        },
      }));
      return result;
    },
    [adminTeamId, service, session],
  );

  const cancel = useCallback(
    async (inviteId: string) => {
      if (adminTeamId === undefined)
        return {
          ok: false as const,
          failure: {
            code: 'invites/forbidden' as const,
            message: 'Somente administradores cancelam convites.',
          },
        };
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          cancelingId: inviteId,
          error: null,
        },
      }));
      const result = await service.cancel(adminTeamId, inviteId);
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          cancelingId: null,
          error: result.ok ? null : result.failure,
        },
      }));
      return result;
    },
    [adminTeamId, service, session],
  );

  const retry = useCallback(() => {
    if (session === null) return;
    setSnapshot({ session, state: LOADING_STATE });
    setReload((value) => value + 1);
  }, [session]);
  const value = useMemo<InvitesContextValue>(
    () => ({
      ...state,
      create,
      cancel,
      consume: (token) => service.consume(token),
      copy: (value) => service.copy(value),
      retry,
    }),
    [cancel, create, retry, service, state],
  );
  return <InvitesContext.Provider value={value}>{children}</InvitesContext.Provider>;
}
