import { useMemo, type ReactNode } from 'react';
import {
  createFirebaseAnalyticsService,
  type AnalyticsService,
} from '../services/analyticsService';
import { AnalyticsContext } from './analyticsContext';

export function AnalyticsProvider({
  children,
  service,
}: {
  readonly children: ReactNode;
  readonly service?: AnalyticsService;
}) {
  const defaultService = useMemo(() => createFirebaseAnalyticsService(), []);
  return (
    <AnalyticsContext.Provider value={service ?? defaultService}>
      {children}
    </AnalyticsContext.Provider>
  );
}
