import { describe, expect, it } from 'vitest';
import { assertAdminContinuity, normalizeMembershipCommand } from '../src/members.js';

describe('normalizeMembershipCommand', () => {
  it('normaliza mudança administrativa e força a saída para o próprio ator', () => {
    expect(
      normalizeMembershipCommand(
        { action: 'change-role', teamId: 'team-1', targetUid: 'user-2', role: 'admin' },
        'user-1',
      ),
    ).toEqual({ action: 'change-role', teamId: 'team-1', targetUid: 'user-2', role: 'admin' });
    expect(
      normalizeMembershipCommand(
        { action: 'leave', teamId: 'team-1', targetUid: 'user-2' },
        'user-1',
      ),
    ).toEqual({ action: 'leave', teamId: 'team-1', targetUid: 'user-1' });
  });

  it('rejeita ação, identificador e nível inválidos', () => {
    expect(() => normalizeMembershipCommand({}, 'user-1')).toThrow('ação de membro é inválida');
    expect(() =>
      normalizeMembershipCommand(
        { action: 'remove', teamId: 'team/1', targetUid: 'user-2' },
        'user-1',
      ),
    ).toThrow('teamId');
    expect(() =>
      normalizeMembershipCommand(
        { action: 'change-role', teamId: 'team-1', targetUid: 'user-2', role: 'owner' },
        'user-1',
      ),
    ).toThrow('nível');
  });
});

describe('assertAdminContinuity', () => {
  it('bloqueia somente a redução do último administrador', () => {
    expect(() => assertAdminContinuity('admin', 'member', 1)).toThrow('último administrador');
    expect(() => assertAdminContinuity('admin', null, 1)).toThrow('último administrador');
    expect(() => assertAdminContinuity('admin', 'member', 2)).not.toThrow();
    expect(() => assertAdminContinuity('member', null, 1)).not.toThrow();
  });
});
