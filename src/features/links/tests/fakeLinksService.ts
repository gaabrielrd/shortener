import { vi } from 'vitest';
import type { LinkFailure, ShortLink } from '../model/link';
import type { LinksService } from '../services/linksService';

export const CREATED_LINK: ShortLink = {
  slug: 'campanha-2026',
  teamId: 'team-1',
  createdBy: 'user-1',
  destinationUrl: 'https://example.com/campanha',
  status: 'active',
  totalClicks: 0,
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z',
};

export function createFakeLinksService() {
  let listener: ((links: readonly ShortLink[]) => void) | undefined;
  let errorListener: ((failure: LinkFailure) => void) | undefined;
  const subscribe = vi.fn<LinksService['subscribe']>((_teamId, _role, _uid, onLinks, onError) => {
    listener = onLinks;
    errorListener = onError;
    return vi.fn();
  });
  const create = vi.fn<LinksService['create']>(() =>
    Promise.resolve({ ok: true, link: CREATED_LINK }),
  );
  const updateDestination = vi.fn<LinksService['updateDestination']>(
    (_teamId, _slug, destinationUrl) =>
      Promise.resolve({
        ok: true,
        changed: true,
        link: { ...CREATED_LINK, destinationUrl },
      }),
  );
  const changeStatus = vi.fn<LinksService['changeStatus']>((_teamId, _slug, command) =>
    Promise.resolve({
      ok: true,
      changed: true,
      link: {
        ...CREATED_LINK,
        status: command === 'disable' ? 'disabled' : command === 'archive' ? 'archived' : 'active',
      },
    }),
  );
  const loadHistory = vi.fn<LinksService['loadHistory']>(() =>
    Promise.resolve({ entries: [], nextCursor: null }),
  );
  const publicUrl = vi.fn<LinksService['publicUrl']>((slug) => `https://go.example.test/${slug}`);
  const copy = vi.fn<LinksService['copy']>(() => Promise.resolve(true));
  return {
    service: {
      subscribe,
      create,
      updateDestination,
      changeStatus,
      loadHistory,
      publicUrl,
      copy,
    } satisfies LinksService,
    subscribe,
    create,
    updateDestination,
    changeStatus,
    loadHistory,
    publicUrl,
    copy,
    emit(links: readonly ShortLink[]) {
      listener?.(links);
    },
    emitError(failure: LinkFailure) {
      errorListener?.(failure);
    },
  };
}
