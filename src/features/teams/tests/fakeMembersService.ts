import { vi } from 'vitest';
import type { MemberFailure, TeamMember } from '../model/member';
import type { MembersService, MembershipCommand } from '../services/membersService';

export function createFakeMembersService() {
  let membersListener: ((members: readonly TeamMember[]) => void) | undefined;
  let errorListener: ((failure: MemberFailure) => void) | undefined;
  const subscribe = vi.fn(
    (
      teamId: string,
      onMembers: (members: readonly TeamMember[]) => void,
      onError: (failure: MemberFailure) => void,
    ) => {
      void teamId;
      membersListener = onMembers;
      errorListener = onError;
      return vi.fn();
    },
  );
  const execute = vi.fn<MembersService['execute']>((command: MembershipCommand) => {
    void command;
    return Promise.resolve({ ok: true });
  });
  const service: MembersService = { subscribe, execute };
  return {
    service,
    subscribe,
    execute,
    emitMembers(members: readonly TeamMember[]) {
      membersListener?.(members);
    },
    emitError(failure: MemberFailure) {
      errorListener?.(failure);
    },
  };
}
