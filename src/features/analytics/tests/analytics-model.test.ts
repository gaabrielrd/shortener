import { describe, expect, it } from 'vitest';
import { fillDailySeries, formatUtcDay, recentUtcDays } from '../model/analytics';

describe('analytics UTC model', () => {
  it('builds the latest 30 calendar days across month and year boundaries', () => {
    const days = recentUtcDays(new Date('2026-01-02T23:30:00-03:00'));
    expect(days).toHaveLength(30);
    expect(days[0]).toBe('2025-12-05');
    expect(days.at(-1)).toBe('2026-01-03');
    expect(recentUtcDays(new Date(), 0)).toEqual([]);
  });

  it('fills missing days with zero without changing persisted counts', () => {
    const points = fillDailySeries(
      [
        { dayUtc: '2026-08-14', count: 3 },
        { dayUtc: '2026-08-15', count: 2 },
      ],
      new Date('2026-08-15T23:59:59.000Z'),
      3,
    );
    expect(points).toEqual([
      { dayUtc: '2026-08-13', count: 0 },
      { dayUtc: '2026-08-14', count: 3 },
      { dayUtc: '2026-08-15', count: 2 },
    ]);
  });

  it('formats a UTC day without shifting it to local time', () => {
    expect(formatUtcDay('2026-08-15')).toBe('15/08/2026');
  });
});
