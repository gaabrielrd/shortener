import { describe, expect, it } from 'vitest';
import { validateTeamName } from '../model/team';

describe('validateTeamName', () => {
  it('aceita nome aparável e distingue vazio de nome longo', () => {
    expect(validateTeamName('  Comunicação  ')).toBeNull();
    expect(validateTeamName('   ')).toEqual(
      expect.objectContaining({ code: 'teams/name-required' }),
    );
    expect(validateTeamName('a'.repeat(81))).toEqual(
      expect.objectContaining({ code: 'teams/name-too-long' }),
    );
  });
});
