import { useEffect, useState, type CSSProperties } from 'react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Table,
  type TableColumn,
} from '@vitru/styleguide';
import { BarChart3, RotateCcw } from 'lucide-react';
import { formatUtcDay, type AnalyticsFailure, type DailyClickPoint } from '../model/analytics';
import { useAnalyticsService } from './analyticsContext';
import styles from './AnalyticsPanel.module.css';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly points: readonly DailyClickPoint[] }
  | { readonly status: 'error'; readonly failure: AnalyticsFailure };

const columns: readonly TableColumn<DailyClickPoint>[] = [
  { key: 'day', header: 'Dia (UTC)', cell: (point) => formatUtcDay(point.dayUtc) },
  { key: 'clicks', header: 'Cliques', cell: (point) => point.count.toLocaleString('pt-BR') },
];

export function AnalyticsPanel({
  slug,
  totalClicks,
}: {
  readonly slug: string;
  readonly totalClicks: number;
}) {
  const service = useAnalyticsService();
  const [revision, setRevision] = useState(0);
  const requestKey = `${slug}:${revision}`;
  const [snapshot, setSnapshot] = useState<{
    readonly key: string | null;
    readonly state: LoadState;
  }>({ key: null, state: { status: 'loading' } });
  const state: LoadState = snapshot.key === requestKey ? snapshot.state : { status: 'loading' };

  useEffect(() => {
    let active = true;
    void service.loadDaily(slug).then((result) => {
      if (!active) return;
      setSnapshot({
        key: requestKey,
        state: result.ok
          ? { status: 'ready', points: result.points }
          : { status: 'error', failure: result.failure },
      });
    });
    return () => {
      active = false;
    };
  }, [requestKey, service, slug]);

  const points = state.status === 'ready' ? state.points : [];
  const periodClicks = points.reduce((total, point) => total + point.count, 0);
  const maximum = Math.max(1, ...points.map((point) => point.count));

  return (
    <Card title="Analytics" tone="raised">
      <div className={styles.summary} aria-label="Resumo de cliques">
        <BarChart3 className="icon" aria-hidden="true" />
        <div>
          <span className={styles.metric}>{totalClicks.toLocaleString('pt-BR')}</span>
          <span className={styles.metricLabel}>cliques no total</span>
        </div>
        {state.status === 'ready' ? (
          <div>
            <span className={styles.periodMetric}>{periodClicks.toLocaleString('pt-BR')}</span>
            <span className={styles.metricLabel}>nos últimos 30 dias UTC</span>
          </div>
        ) : null}
      </div>

      {state.status === 'loading' ? (
        <LoadingState label="Carregando evolução diária..." />
      ) : state.status === 'error' ? (
        <ErrorState
          title="Não foi possível carregar a evolução diária"
          description={state.failure.message}
          action={
            <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>
              <RotateCcw className="icon icon-sm" aria-hidden="true" /> Tentar novamente
            </Button>
          }
        />
      ) : (
        <>
          {periodClicks === 0 ? (
            <EmptyState
              title="Nenhum clique nos últimos 30 dias"
              description="Os dias sem acesso continuam representados com zero abaixo."
            />
          ) : null}
          <div className={styles.chartBlock}>
            <p className={styles.chartTitle}>Evolução diária — últimos 30 dias UTC</p>
            <div className={styles.chart} aria-hidden="true">
              {points.map((point) => (
                <span
                  className={styles.bar}
                  key={point.dayUtc}
                  title={`${formatUtcDay(point.dayUtc)}: ${point.count} cliques`}
                  style={
                    {
                      '--bar-height': `${point.count === 0 ? 0 : Math.max(8, (point.count / maximum) * 100)}%`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
          <div className={styles.tableWrap}>
            <Table
              caption={`Cliques diários em UTC do link ${slug}, últimos 30 dias`}
              columns={columns}
              rows={[...points].reverse()}
              rowKey={(point) => point.dayUtc}
            />
          </div>
        </>
      )}
    </Card>
  );
}
