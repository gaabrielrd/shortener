export type InviteStatus = 'active' | 'expired' | 'canceled';

export interface TeamInvite {
  readonly id: string;
  readonly teamId: string;
  readonly createdBy: string;
  readonly expiresAt: string;
  readonly canceledAt: string | null;
  readonly createdAt: string;
}

export type InviteFailureCode =
  | 'invites/unauthenticated'
  | 'invites/forbidden'
  | 'invites/not-found'
  | 'invites/expired'
  | 'invites/canceled'
  | 'invites/validation'
  | 'invites/unavailable'
  | 'invites/unknown';

export interface InviteFailure {
  readonly code: InviteFailureCode;
  readonly message: string;
  readonly field?: 'expiresAt';
}

export type InviteOperationResult =
  { readonly ok: true } | { readonly ok: false; readonly failure: InviteFailure };

export type CreateInviteResult =
  | { readonly ok: true; readonly invite: TeamInvite; readonly token: string }
  | { readonly ok: false; readonly failure: InviteFailure };

export type ConsumeInviteResult =
  | {
      readonly ok: true;
      readonly teamId: string;
      readonly teamName: string;
      readonly alreadyMember: boolean;
    }
  | { readonly ok: false; readonly failure: InviteFailure };

export type InvitesStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error';

export interface InvitesState {
  readonly status: InvitesStatus;
  readonly invites: readonly TeamInvite[];
  readonly error: InviteFailure | null;
  readonly isCreating: boolean;
  readonly cancelingId: string | null;
}

export function getClientInviteStatus(invite: TeamInvite, now = Date.now()): InviteStatus {
  if (invite.canceledAt !== null) return 'canceled';
  return Date.parse(invite.expiresAt) <= now ? 'expired' : 'active';
}

export function validateInviteExpiration(value: string, now = Date.now()): InviteFailure | null {
  const milliseconds = Date.parse(value);
  if (!value || !Number.isFinite(milliseconds) || milliseconds <= now) {
    return {
      code: 'invites/validation',
      message: 'Escolha uma data e hora futuras.',
      field: 'expiresAt',
    };
  }
  return null;
}
