import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth';
import { useTeams } from '@/features/teams';
import type { LinksState, LinkStatusCommand } from '../model/link';
import { createFirebaseLinksService, type LinksService } from '../services/linksService';
import { LinksContext, type LinksContextValue } from './linksContext';

const INITIAL_STATE: LinksState = {
  status: 'idle',
  links: [],
  error: null,
  isCreating: false,
  operatingSlug: null,
};
const LOADING_STATE: LinksState = { ...INITIAL_STATE, status: 'loading' };
const defaultService = createFirebaseLinksService();

export function LinksProvider({
  children,
  service = defaultService,
}: {
  readonly children: ReactNode;
  readonly service?: LinksService;
}) {
  const auth = useAuth();
  const teams = useTeams();
  const activeTeam = teams.activeTeam;
  const activeTeamId = activeTeam?.id;
  const activeTeamRole = activeTeam?.role;
  const uid = auth.user?.uid;
  const session = useMemo(
    () =>
      activeTeamId === undefined || activeTeamRole === undefined || uid === undefined
        ? null
        : Symbol(`${activeTeamId}:${activeTeamRole}:${uid}`),
    [activeTeamId, activeTeamRole, uid],
  );
  const [snapshot, setSnapshot] = useState<{ session: symbol | null; state: LinksState }>({
    session: null,
    state: INITIAL_STATE,
  });
  const [reload, setReload] = useState(0);
  const [destinationDrafts, setDestinationDrafts] = useState<Record<string, string>>({});
  const state =
    session === null
      ? INITIAL_STATE
      : snapshot.session === session
        ? snapshot.state
        : LOADING_STATE;

  useEffect(() => {
    if (
      session === null ||
      activeTeamId === undefined ||
      activeTeamRole === undefined ||
      uid === undefined
    )
      return;
    return service.subscribe(
      activeTeamId,
      activeTeamRole,
      uid,
      (links) =>
        setSnapshot((current) => ({
          session,
          state: {
            ...(current.session === session ? current.state : LOADING_STATE),
            status: links.length === 0 ? 'empty' : 'ready',
            links,
            error: null,
          },
        })),
      (error) => setSnapshot({ session, state: { ...LOADING_STATE, status: 'error', error } }),
    );
  }, [activeTeamId, activeTeamRole, reload, service, session, uid]);

  const create = useCallback(
    async (slug: string, destinationUrl: string) => {
      if (activeTeamId === undefined) {
        return {
          ok: false as const,
          failure: { code: 'links/forbidden' as const, message: 'Selecione uma equipe.' },
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
      const result = await service.create(activeTeamId, slug, destinationUrl);
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
    [activeTeamId, service, session],
  );

  const retry = useCallback(() => {
    if (session === null) return;
    setSnapshot({ session, state: LOADING_STATE });
    setReload((value) => value + 1);
  }, [session]);
  const operate = useCallback(
    async (slug: string, operation: () => ReturnType<LinksService['updateDestination']>) => {
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          operatingSlug: slug,
          error: null,
        },
      }));
      const result = await operation();
      setSnapshot((current) => ({
        session,
        state: {
          ...(current.session === session ? current.state : LOADING_STATE),
          operatingSlug: null,
          error: result.ok ? null : result.failure,
        },
      }));
      return result;
    },
    [session],
  );
  const updateDestination = useCallback(
    (slug: string, destinationUrl: string) => {
      if (activeTeamId === undefined)
        return Promise.resolve({
          ok: false as const,
          failure: { code: 'links/forbidden' as const, message: 'Selecione uma equipe.' },
        });
      return operate(slug, () => service.updateDestination(activeTeamId, slug, destinationUrl));
    },
    [activeTeamId, operate, service],
  );
  const changeStatus = useCallback(
    (slug: string, command: LinkStatusCommand) => {
      if (activeTeamId === undefined)
        return Promise.resolve({
          ok: false as const,
          failure: { code: 'links/forbidden' as const, message: 'Selecione uma equipe.' },
        });
      return operate(slug, () => service.changeStatus(activeTeamId, slug, command));
    },
    [activeTeamId, operate, service],
  );
  const value = useMemo<LinksContextValue>(
    () => ({
      ...state,
      create,
      updateDestination,
      changeStatus,
      loadHistory: service.loadHistory,
      destinationDraft: (slug, fallback) => destinationDrafts[slug] ?? fallback,
      setDestinationDraft: (slug, value) =>
        setDestinationDrafts((current) => ({ ...current, [slug]: value })),
      clearDestinationDraft: (slug) =>
        setDestinationDrafts((current) => {
          const next = { ...current };
          delete next[slug];
          return next;
        }),
      publicUrl: service.publicUrl,
      copy: service.copy,
      retry,
    }),
    [changeStatus, create, destinationDrafts, retry, service, state, updateDestination],
  );
  return <LinksContext.Provider value={value}>{children}</LinksContext.Provider>;
}
