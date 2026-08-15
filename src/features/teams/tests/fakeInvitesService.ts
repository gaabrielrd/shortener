import { vi } from 'vitest';
import type { InviteFailure, TeamInvite } from '../model/invite';
import type { InvitesService } from '../services/invitesService';

const CREATED_INVITE: TeamInvite = {
  id: 'hash-1',
  teamId: 'team-1',
  createdBy: 'user-1',
  expiresAt: '2030-01-01T13:00:00.000Z',
  canceledAt: null,
  createdAt: '2026-08-15T12:00:00.000Z',
};

export function createFakeInvitesService() {
  let listener: ((invites: readonly TeamInvite[]) => void) | undefined;
  let errorListener: ((failure: InviteFailure) => void) | undefined;
  const subscribe = vi.fn<InvitesService['subscribe']>((_teamId, onInvites, onError) => {
    listener = onInvites;
    errorListener = onError;
    return vi.fn();
  });
  const create = vi.fn<InvitesService['create']>(() =>
    Promise.resolve({ ok: true, invite: CREATED_INVITE, token: 'T'.repeat(43) }),
  );
  const cancel = vi.fn<InvitesService['cancel']>(() => Promise.resolve({ ok: true }));
  const consume = vi.fn<InvitesService['consume']>(() =>
    Promise.resolve({
      ok: true,
      teamId: 'team-1',
      teamName: 'Comunicação',
      alreadyMember: false,
    }),
  );
  const copy = vi.fn<InvitesService['copy']>(() => Promise.resolve(true));
  return {
    service: { subscribe, create, cancel, consume, copy } satisfies InvitesService,
    subscribe,
    create,
    cancel,
    consume,
    copy,
    emit(invites: readonly TeamInvite[]) {
      listener?.(invites);
    },
    emitError(failure: InviteFailure) {
      errorListener?.(failure);
    },
  };
}

export { CREATED_INVITE };
