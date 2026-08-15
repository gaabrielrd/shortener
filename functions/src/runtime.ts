export const FUNCTION_REGION = 'southamerica-east1';

export const CALLABLE_OPTIONS = {
  region: FUNCTION_REGION,
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 10,
  concurrency: 40,
} as const;

export const PUBLIC_REDIRECT_OPTIONS = {
  region: FUNCTION_REGION,
  memory: '256MiB',
  timeoutSeconds: 10,
  maxInstances: 20,
  concurrency: 80,
  cors: false,
} as const;

export const HEALTH_OPTIONS = {
  region: FUNCTION_REGION,
  memory: '256MiB',
  timeoutSeconds: 10,
  maxInstances: 3,
  concurrency: 40,
  cors: false,
} as const;
