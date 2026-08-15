export const RESERVED_SLUGS = new Set([
  'api',
  'app',
  'assets',
  'favicon',
  'health',
  'invite',
  'login',
  'logout',
  'manifest',
  'robots',
  'styleguide',
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/;

export type LinkStatus = 'active' | 'disabled' | 'archived';
export type LinkStatusCommand = 'disable' | 'archive' | 'restore';
export type LinkHistoryAction =
  'created' | 'destination_changed' | 'disabled' | 'archived' | 'restored';

export interface ShortLink {
  readonly slug: string;
  readonly teamId: string;
  readonly createdBy: string;
  readonly destinationUrl: string;
  readonly status: LinkStatus;
  readonly totalClicks: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type LinkFailureCode =
  | 'links/validation'
  | 'links/conflict'
  | 'links/unauthenticated'
  | 'links/forbidden'
  | 'links/not-found'
  | 'links/invalid-transition'
  | 'links/unavailable'
  | 'links/unknown';

export interface LinkFailure {
  readonly code: LinkFailureCode;
  readonly message: string;
  readonly field?: 'slug' | 'destinationUrl' | 'status';
}

export type CreateLinkResult =
  | { readonly ok: true; readonly link: ShortLink }
  | { readonly ok: false; readonly failure: LinkFailure };

export type LinkOperationResult =
  | { readonly ok: true; readonly changed: boolean; readonly link: ShortLink }
  | { readonly ok: false; readonly failure: LinkFailure };

export interface LinkHistoryEntry {
  readonly id: string;
  readonly action: LinkHistoryAction;
  readonly actorId: string;
  readonly previousValue: string | null;
  readonly nextValue: string | null;
  readonly createdAt: string;
}

export interface HistoryCursor {
  readonly id: string;
  readonly createdAt: string;
}

export interface HistoryPage {
  readonly entries: readonly LinkHistoryEntry[];
  readonly nextCursor: HistoryCursor | null;
}

export type LinksStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error';

export interface LinksState {
  readonly status: LinksStatus;
  readonly links: readonly ShortLink[];
  readonly error: LinkFailure | null;
  readonly isCreating: boolean;
  readonly operatingSlug: string | null;
}

export function statusLabel(status: LinkStatus): string {
  if (status === 'active') return 'Ativo';
  if (status === 'disabled') return 'Desativado';
  return 'Arquivado';
}

export function historyActionLabel(action: LinkHistoryAction): string {
  if (action === 'created') return 'Link criado';
  if (action === 'destination_changed') return 'Destino alterado';
  if (action === 'disabled') return 'Link desativado';
  if (action === 'archived') return 'Link arquivado';
  return 'Link restaurado';
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function validateSlug(value: string): LinkFailure | null {
  const slug = normalizeSlug(value);
  if (!SLUG_PATTERN.test(slug)) {
    return {
      code: 'links/validation',
      field: 'slug',
      message: 'Use de 3 a 50 letras minúsculas, números ou hífens, sem hífen nas pontas.',
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return {
      code: 'links/validation',
      field: 'slug',
      message: 'Este endereço é reservado pelo sistema.',
    };
  }
  return null;
}

export function validateDestinationUrl(value: string): LinkFailure | null {
  try {
    const destination = new URL(value.trim());
    if (
      (destination.protocol !== 'http:' && destination.protocol !== 'https:') ||
      !destination.host ||
      value.length > 2_048
    ) {
      throw new Error('invalid destination');
    }
    return null;
  } catch {
    return {
      code: 'links/validation',
      field: 'destinationUrl',
      message: 'Informe um destino absoluto iniciado por http:// ou https://.',
    };
  }
}
