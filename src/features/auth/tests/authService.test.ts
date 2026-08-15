import { FirebaseError } from 'firebase/app';
import { describe, expect, it } from 'vitest';
import { safeReturnPath, toAuthFailure } from '../services/authService';

describe('safeReturnPath', () => {
  it.each([
    [undefined, '/app'],
    ['https://example.com', '/app'],
    ['//example.com', '/app'],
    ['/login', '/app'],
    ['/app?filtro=meus', '/app?filtro=meus'],
  ])('normaliza %s para %s', (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });
});

describe('toAuthFailure', () => {
  it('traduz cancelamento sem expor detalhes do SDK', () => {
    const failure = toAuthFailure(
      new FirebaseError('auth/popup-closed-by-user', 'internal detail'),
      'auth/unknown',
    );
    expect(failure).toEqual({
      code: 'auth/cancelled',
      message: 'O acesso com Google foi cancelado.',
    });
  });

  it('distingue falha de rede e mantém erro desconhecido recuperável', () => {
    expect(
      toAuthFailure(new FirebaseError('auth/network-request-failed', 'offline'), 'auth/unknown')
        .code,
    ).toBe('auth/network');
    expect(toAuthFailure(new Error('unknown'), 'auth/profile')).toEqual({
      code: 'auth/profile',
      message: 'Não foi possível concluir o acesso. Tente novamente.',
    });
  });
});
