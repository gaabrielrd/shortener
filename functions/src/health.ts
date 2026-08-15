export interface HealthPayload {
  readonly service: 'shortener-functions';
  readonly status: 'ok';
}

export function createHealthPayload(): HealthPayload {
  return {
    service: 'shortener-functions',
    status: 'ok',
  };
}
