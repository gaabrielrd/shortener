import type { TeamRole } from './team';

export interface TeamMember {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: TeamRole;
}

export type MemberFailureCode =
  | 'members/unauthenticated'
  | 'members/forbidden'
  | 'members/not-found'
  | 'members/last-admin'
  | 'members/unavailable'
  | 'members/unknown';

export interface MemberFailure {
  readonly code: MemberFailureCode;
  readonly message: string;
}

export type MemberOperationResult =
  { readonly ok: true } | { readonly ok: false; readonly failure: MemberFailure };

export type MembersStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error';

export interface MembersState {
  readonly status: MembersStatus;
  readonly members: readonly TeamMember[];
  readonly error: MemberFailure | null;
  readonly operatingUid: string | null;
  readonly feedback: string | null;
}
