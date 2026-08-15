import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import {
  generateInviteToken,
  getInviteStatus,
  hashInviteToken,
  normalizeInviteExpiration,
  normalizeInviteToken,
} from '../src/invites.js';

describe('convites', () => {
  it('gera token opaco com entropia e hash estável sem persistir o segredo', () => {
    const first = generateInviteToken();
    const second = generateInviteToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(hashInviteToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInviteToken(first)).toBe(hashInviteToken(first));
    expect(normalizeInviteToken(first)).toBe(first);
  });

  it('recusa token malformado e validade ausente, inválida ou passada', () => {
    const now = Timestamp.fromMillis(Date.parse('2026-08-15T12:00:00.000Z'));
    expect(() => normalizeInviteToken('curto')).toThrow(/inválido/i);
    expect(() => normalizeInviteExpiration(undefined, now)).toThrow(/futura/i);
    expect(() => normalizeInviteExpiration('data', now)).toThrow(/futuro/i);
    expect(() => normalizeInviteExpiration('2026-08-15T12:00:00.000Z', now)).toThrow(/futuro/i);
    expect(normalizeInviteExpiration('2026-08-16T12:00:00.000Z', now).toMillis()).toBe(
      Date.parse('2026-08-16T12:00:00.000Z'),
    );
  });

  it('deriva estados ativo, vencido e cancelado pelo relógio do servidor', () => {
    const now = Timestamp.fromMillis(2_000);
    expect(getInviteStatus({ expiresAt: Timestamp.fromMillis(2_001), canceledAt: null }, now)).toBe(
      'active',
    );
    expect(getInviteStatus({ expiresAt: Timestamp.fromMillis(2_000), canceledAt: null }, now)).toBe(
      'expired',
    );
    expect(
      getInviteStatus(
        { expiresAt: Timestamp.fromMillis(3_000), canceledAt: Timestamp.fromMillis(1_000) },
        now,
      ),
    ).toBe('canceled');
  });
});
