import { createContext, useContext } from 'react';
import type {
  CreateLinkResult,
  HistoryCursor,
  HistoryPage,
  LinkOperationResult,
  LinksState,
  LinkStatusCommand,
} from '../model/link';

export interface LinksContextValue extends LinksState {
  readonly create: (slug: string, destinationUrl: string) => Promise<CreateLinkResult>;
  readonly updateDestination: (
    slug: string,
    destinationUrl: string,
  ) => Promise<LinkOperationResult>;
  readonly changeStatus: (slug: string, command: LinkStatusCommand) => Promise<LinkOperationResult>;
  readonly loadHistory: (slug: string, cursor?: HistoryCursor) => Promise<HistoryPage>;
  readonly destinationDraft: (slug: string, fallback: string) => string;
  readonly setDestinationDraft: (slug: string, value: string) => void;
  readonly clearDestinationDraft: (slug: string) => void;
  readonly publicUrl: (slug: string) => string;
  readonly copy: (value: string) => Promise<boolean>;
  readonly retry: () => void;
}

export const LinksContext = createContext<LinksContextValue | null>(null);

export function useLinks(): LinksContextValue {
  const value = useContext(LinksContext);
  if (value === null) throw new Error('useLinks exige LinksProvider.');
  return value;
}
