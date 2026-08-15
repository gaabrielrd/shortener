import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { buildUserProfile, isGoogleAuthToken } from '../src/profile.js';

describe('buildUserProfile', () => {
  it('mantém somente o perfil mínimo e preserva a criação existente', () => {
    const createdAt = Timestamp.fromMillis(1_000);
    const updatedAt = Timestamp.fromMillis(2_000);

    expect(
      buildUserProfile('uid-1', '  Ana Silva  ', ' ANA@EXAMPLE.COM ', updatedAt, createdAt),
    ).toEqual({
      uid: 'uid-1',
      displayName: 'Ana Silva',
      email: 'ana@example.com',
      createdAt,
      updatedAt,
    });
  });
});

describe('isGoogleAuthToken', () => {
  it('aceita somente o provedor Google declarado pelo Firebase Auth', () => {
    expect(isGoogleAuthToken({ firebase: { sign_in_provider: 'google.com' } })).toBe(true);
    expect(isGoogleAuthToken({ firebase: { sign_in_provider: 'password' } })).toBe(false);
    expect(isGoogleAuthToken({})).toBe(false);
  });
});
