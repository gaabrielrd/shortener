import { FirebaseError } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  firestore: { kind: 'firestore' },
  collection: vi.fn(() => ({ kind: 'collection' })),
  where: vi.fn((...parts: unknown[]) => ({ kind: 'where', parts })),
  orderBy: vi.fn((...parts: unknown[]) => ({ kind: 'orderBy', parts })),
  limit: vi.fn((value: number) => ({ kind: 'limit', value })),
  query: vi.fn(() => ({ kind: 'query' })),
  getDocs: vi.fn<() => Promise<{ docs: Array<{ id: string; data(): unknown }> }>>(() =>
    Promise.resolve({ docs: [] }),
  ),
  getFirebaseServices: vi.fn(),
}));

vi.mock('@/shared/services/firebase', () => ({ getFirebaseServices: sdk.getFirebaseServices }));
vi.mock('firebase/firestore', () => ({
  collection: sdk.collection,
  where: sdk.where,
  orderBy: sdk.orderBy,
  limit: sdk.limit,
  query: sdk.query,
  getDocs: sdk.getDocs,
}));

describe('Firebase analytics service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.getFirebaseServices.mockReturnValue({ firestore: sdk.firestore });
  });

  it('limits the UTC query and fills every calendar day', async () => {
    sdk.getDocs.mockResolvedValueOnce({
      docs: [
        { id: '2026-08-14', data: () => ({ dayUtc: '2026-08-14', count: 4 }) },
        { id: '2026-08-15', data: () => ({ dayUtc: '2026-08-15', count: 2 }) },
      ],
    });
    const { createFirebaseAnalyticsService } = await import('../services/analyticsService');
    const result = await createFirebaseAnalyticsService().loadDaily(
      'campanha',
      new Date('2026-08-15T12:00:00.000Z'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.points).toHaveLength(30);
      expect(result.points.at(-2)).toEqual({ dayUtc: '2026-08-14', count: 4 });
      expect(result.points.at(-1)).toEqual({ dayUtc: '2026-08-15', count: 2 });
    }
    expect(sdk.collection).toHaveBeenCalledWith(sdk.firestore, 'links', 'campanha', 'dailyClicks');
    expect(sdk.where).toHaveBeenCalledWith('dayUtc', '>=', '2026-07-17');
    expect(sdk.where).toHaveBeenCalledWith('dayUtc', '<=', '2026-08-15');
    expect(sdk.orderBy).toHaveBeenCalledWith('dayUtc', 'asc');
    expect(sdk.limit).toHaveBeenCalledWith(30);
  });

  it('rejects malformed aggregates instead of displaying inconsistent data', async () => {
    sdk.getDocs.mockResolvedValueOnce({
      docs: [{ id: '2026-08-15', data: () => ({ dayUtc: '2026-08-14', count: -1 }) }],
    });
    const { createFirebaseAnalyticsService } = await import('../services/analyticsService');
    const result = await createFirebaseAnalyticsService().loadDaily(
      'campanha',
      new Date('2026-08-15T12:00:00.000Z'),
    );
    expect(result).toMatchObject({
      ok: false,
      failure: { code: 'analytics/invalid-data' },
    });
  });

  it.each([
    ['permission-denied', 'analytics/forbidden'],
    ['unauthenticated', 'analytics/unauthenticated'],
    ['unavailable', 'analytics/unavailable'],
  ])('maps Firebase %s without leaking details', async (firebaseCode, expectedCode) => {
    sdk.getDocs.mockRejectedValueOnce(new FirebaseError(firebaseCode, 'private backend detail'));
    const { createFirebaseAnalyticsService } = await import('../services/analyticsService');
    const result = await createFirebaseAnalyticsService().loadDaily('campanha');
    expect(result).toMatchObject({ ok: false, failure: { code: expectedCode } });
    if (!result.ok) expect(result.failure.message).not.toContain('private backend detail');
  });
});
