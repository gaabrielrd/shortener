import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsPanel, AnalyticsProvider, type AnalyticsService } from '../index';

function renderPanel(service: AnalyticsService, totalClicks = 8) {
  return {
    user: userEvent.setup(),
    ...render(
      <AnalyticsProvider service={service}>
        <AnalyticsPanel slug="campanha" totalClicks={totalClicks} />
      </AnalyticsProvider>,
    ),
  };
}

describe('AnalyticsPanel', () => {
  it('shows total, UTC period, bars and an accessible table', async () => {
    const service: AnalyticsService = {
      loadDaily: () =>
        Promise.resolve({
          ok: true,
          points: [
            { dayUtc: '2026-08-14', count: 3 },
            { dayUtc: '2026-08-15', count: 5 },
          ],
        }),
    };
    renderPanel(service);
    expect(screen.getByText('8')).toBeVisible();
    expect(await screen.findByText('nos últimos 30 dias UTC')).toBeVisible();
    const table = screen.getByRole('table', { name: /cliques diários em UTC/i });
    expect(within(table).getByText('15/08/2026')).toBeVisible();
    expect(within(table).getByText('5')).toBeVisible();
  });

  it('represents a zero total and zero days as a valid empty state', async () => {
    const service: AnalyticsService = {
      loadDaily: () =>
        Promise.resolve({
          ok: true,
          points: [{ dayUtc: '2026-08-15', count: 0 }],
        }),
    };
    renderPanel(service, 0);
    expect(await screen.findByText('Nenhum clique nos últimos 30 dias')).toBeVisible();
    expect(screen.getAllByText('0')).not.toHaveLength(0);
  });

  it('keeps the total visible on partial failure and retries from the keyboard', async () => {
    const loadDaily = vi
      .fn<AnalyticsService['loadDaily']>()
      .mockResolvedValueOnce({
        ok: false,
        failure: { code: 'analytics/forbidden', message: 'Você não tem permissão.' },
      })
      .mockResolvedValueOnce({
        ok: true,
        points: [{ dayUtc: '2026-08-15', count: 2 }],
      });
    const { user } = renderPanel({ loadDaily }, 17);
    expect(await screen.findByText('Não foi possível carregar a evolução diária')).toBeVisible();
    expect(screen.getByText('17')).toBeVisible();
    const retry = screen.getByRole('button', { name: 'Tentar novamente' });
    retry.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('nos últimos 30 dias UTC')).toBeVisible();
    expect(loadDaily).toHaveBeenCalledTimes(2);
  });
});
