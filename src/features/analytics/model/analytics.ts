export interface DailyClickPoint {
  readonly dayUtc: string;
  readonly count: number;
}

export type AnalyticsFailureCode =
  | 'analytics/unauthenticated'
  | 'analytics/forbidden'
  | 'analytics/unavailable'
  | 'analytics/invalid-data'
  | 'analytics/unknown';

export interface AnalyticsFailure {
  readonly code: AnalyticsFailureCode;
  readonly message: string;
}

export type AnalyticsResult =
  | { readonly ok: true; readonly points: readonly DailyClickPoint[] }
  | { readonly ok: false; readonly failure: AnalyticsFailure };

export function recentUtcDays(now: Date, numberOfDays = 30): readonly string[] {
  if (!Number.isInteger(numberOfDays) || numberOfDays < 1) return [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days: string[] = [];
  for (let offset = numberOfDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(cursor);
    day.setUTCDate(cursor.getUTCDate() - offset);
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}

export function fillDailySeries(
  entries: readonly DailyClickPoint[],
  now: Date,
  numberOfDays = 30,
): readonly DailyClickPoint[] {
  const counts = new Map(entries.map((entry) => [entry.dayUtc, entry.count]));
  return recentUtcDays(now, numberOfDays).map((dayUtc) => ({
    dayUtc,
    count: counts.get(dayUtc) ?? 0,
  }));
}

export function formatUtcDay(dayUtc: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dayUtc}T00:00:00.000Z`));
}
