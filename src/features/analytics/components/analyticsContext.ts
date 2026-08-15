import { createContext, useContext } from 'react';
import type { AnalyticsService } from '../services/analyticsService';

export const AnalyticsContext = createContext<AnalyticsService | null>(null);

export function useAnalyticsService(): AnalyticsService {
  const service = useContext(AnalyticsContext);
  if (service === null) throw new Error('AnalyticsProvider não foi configurado.');
  return service;
}
