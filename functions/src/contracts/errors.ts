export const ERROR_CODES = {
  unauthenticated: 'auth/unauthenticated',
  forbidden: 'auth/forbidden',
  validationFailed: 'validation/failed',
  conflict: 'resource/conflict',
  notFound: 'resource/not-found',
  unavailable: 'service/unavailable',
  internal: 'service/internal',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Forma estável devolvida pelas Functions; detalhes internos nunca entram na resposta. */
export interface ErrorResponse {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly field?: string;
  };
}
