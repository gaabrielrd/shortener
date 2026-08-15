import { createContext, useContext } from 'react';
import type { MemberOperationResult, MembersState } from '../model/member';
import type { TeamRole } from '../model/team';

export interface MembersContextValue extends MembersState {
  readonly changeRole: (uid: string, role: TeamRole) => Promise<MemberOperationResult>;
  readonly removeMember: (uid: string) => Promise<MemberOperationResult>;
  readonly leaveTeam: () => Promise<MemberOperationResult>;
  readonly clearFeedback: () => void;
  readonly retry: () => void;
}

export const MembersContext = createContext<MembersContextValue | null>(null);

export function useMembers(): MembersContextValue {
  const value = useContext(MembersContext);
  if (value === null) throw new Error('useMembers deve ser usado dentro de MembersProvider.');
  return value;
}
