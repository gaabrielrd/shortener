import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { buildInitialTeamRecords, normalizeTeamName } from '../src/teams.js';

describe('normalizeTeamName', () => {
  it('apara um nome válido e rejeita vazio ou mais de 80 caracteres', () => {
    expect(normalizeTeamName('  Comunicação Interna  ')).toBe('Comunicação Interna');
    expect(() => normalizeTeamName('   ')).toThrow('Informe o nome da equipe.');
    expect(() => normalizeTeamName('a'.repeat(81))).toThrow('no máximo 80 caracteres');
  });
});

describe('buildInitialTeamRecords', () => {
  it('cria exatamente a equipe e a associação administrativa inicial', () => {
    const now = Timestamp.fromMillis(1_000);

    expect(
      buildInitialTeamRecords(
        'team-1',
        'user-1',
        ' Ana Silva ',
        ' ANA@EXAMPLE.COM ',
        'Comunicação',
        now,
      ),
    ).toEqual({
      team: {
        id: 'team-1',
        name: 'Comunicação',
        createdBy: 'user-1',
        createdAt: now,
        updatedAt: now,
      },
      member: {
        uid: 'user-1',
        teamId: 'team-1',
        role: 'admin',
        displayName: 'Ana Silva',
        email: 'ana@example.com',
        joinedAt: now,
      },
    });
  });
});
