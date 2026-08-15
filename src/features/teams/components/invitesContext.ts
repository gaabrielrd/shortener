import { createContext, useContext } from 'react';
import type {
  ConsumeInviteResult,
  CreateInviteResult,
  InviteOperationResult,
  InvitesState,
} from '../model/invite';

export interface InvitesContextValue extends InvitesState {
  readonly create: (expiresAt: string) => Promise<CreateInviteResult>;
  readonly cancel: (inviteId: string) => Promise<InviteOperationResult>;
  readonly consume: (token: string) => Promise<ConsumeInviteResult>;
  readonly copy: (value: string) => Promise<boolean>;
  readonly retry: () => void;
}

export const InvitesContext = createContext<InvitesContextValue | null>(null);

export function useInvites(): InvitesContextValue {
  const value = useContext(InvitesContext);
  if (value === null) throw new Error('useInvites exige InvitesProvider.');
  return value;
}
