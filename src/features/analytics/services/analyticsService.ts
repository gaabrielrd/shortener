import { FirebaseError } from 'firebase/app';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { getFirebaseServices } from '@/shared/services/firebase';
import {
  fillDailySeries,
  recentUtcDays,
  type AnalyticsFailure,
  type AnalyticsResult,
  type DailyClickPoint,
} from '../model/analytics';

export interface AnalyticsService {
  readonly loadDaily: (slug: string, now?: Date) => Promise<AnalyticsResult>;
}

function failureFrom(error: unknown): AnalyticsFailure {
  if (error instanceof FirebaseError) {
    if (error.code === 'unauthenticated') {
      return {
        code: 'analytics/unauthenticated',
        message: 'Sua sessão expirou. Entre novamente.',
      };
    }
    if (error.code === 'permission-denied') {
      return {
        code: 'analytics/forbidden',
        message: 'Você não tem permissão para ver os analytics deste link.',
      };
    }
    if (error.code === 'unavailable') {
      return {
        code: 'analytics/unavailable',
        message: 'Os analytics estão temporariamente indisponíveis.',
      };
    }
  }
  return { code: 'analytics/unknown', message: 'Não foi possível carregar os analytics.' };
}

function dailyPoint(id: string, value: unknown): DailyClickPoint | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  if (
    data['dayUtc'] !== id ||
    !/^\d{4}-\d{2}-\d{2}$/.test(id) ||
    !Number.isSafeInteger(data['count']) ||
    (data['count'] as number) < 0
  ) {
    return null;
  }
  return { dayUtc: id, count: data['count'] as number };
}

export function createFirebaseAnalyticsService(): AnalyticsService {
  return {
    async loadDaily(slug, now = new Date()) {
      const days = recentUtcDays(now);
      const firstDay = days[0];
      const lastDay = days.at(-1);
      if (firstDay === undefined || lastDay === undefined) {
        return {
          ok: false,
          failure: { code: 'analytics/invalid-data', message: 'A janela de analytics é inválida.' },
        };
      }
      try {
        const { firestore } = getFirebaseServices();
        const snapshot = await getDocs(
          query(
            collection(firestore, 'links', slug, 'dailyClicks'),
            where('dayUtc', '>=', firstDay),
            where('dayUtc', '<=', lastDay),
            orderBy('dayUtc', 'asc'),
            limit(30),
          ),
        );
        const points = snapshot.docs.map((entry) => dailyPoint(entry.id, entry.data()));
        if (points.some((point) => point === null)) {
          return {
            ok: false,
            failure: {
              code: 'analytics/invalid-data',
              message: 'Os analytics recebidos são inválidos.',
            },
          };
        }
        return {
          ok: true,
          points: fillDailySeries(points as readonly DailyClickPoint[], now),
        };
      } catch (error) {
        return { ok: false, failure: failureFrom(error) };
      }
    },
  };
}
