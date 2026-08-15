import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  cancelInviteRecord,
  consumeInviteRecord,
  createInviteRecord,
  hashInviteToken,
} from '../../functions/lib/invites.js';

const projectId = 'demo-shortener';
const app = initializeApp({ projectId }, 'invites-emulator-tests');
const firestore = getFirestore(app);
const teamId = `invites-${Date.now()}`;
const activeToken = 'A'.repeat(43);
const expiredToken = 'B'.repeat(43);

before(async () => {
  const team = firestore.collection('teams').doc(teamId);
  const batch = firestore.batch();
  batch.set(team, { id: teamId, name: 'Equipe de convites' });
  batch.set(team.collection('members').doc('admin'), { uid: 'admin', teamId, role: 'admin' });
  batch.set(team.collection('members').doc('member'), { uid: 'member', teamId, role: 'member' });
  await batch.commit();
});

after(async () => {
  await deleteApp(app);
});

test('somente administrador cria e o Firestore guarda apenas o hash', async () => {
  const now = Timestamp.fromMillis(1_000);
  const expiresAt = Timestamp.fromMillis(10_000);
  await assert.rejects(
    createInviteRecord(firestore, {
      teamId,
      uid: 'member',
      expiresAt,
      now,
      token: 'C'.repeat(43),
    }),
    (error) => error?.code === 'permission-denied',
  );

  const created = await createInviteRecord(firestore, {
    teamId,
    uid: 'admin',
    expiresAt,
    now,
    token: activeToken,
  });
  assert.equal(created.id, hashInviteToken(activeToken));
  const persisted = await firestore.collection('inviteTokens').doc(created.id).get();
  assert.equal(persisted.exists, true);
  assert.equal(JSON.stringify(persisted.data()).includes(activeToken), false);
});

test('o mesmo convite adiciona usuários diferentes e repetir é idempotente', async () => {
  const consume = (uid) =>
    consumeInviteRecord(firestore, {
      token: activeToken,
      uid,
      displayName: uid,
      email: `${uid}@example.test`,
      now: Timestamp.fromMillis(2_000),
    });

  assert.equal((await consume('guest-1')).alreadyMember, false);
  assert.equal((await consume('guest-2')).alreadyMember, false);
  assert.equal((await consume('guest-1')).alreadyMember, true);
  const members = await firestore.collection('teams').doc(teamId).collection('members').get();
  assert.equal(members.docs.filter((document) => document.id === 'guest-1').length, 1);
  assert.equal(members.docs.filter((document) => document.id === 'guest-2').length, 1);
  assert.equal(members.docs.find((document) => document.id === 'guest-1')?.get('role'), 'member');
});

test('cancelamento e vencimento bloqueiam novas associações', async () => {
  const activeId = hashInviteToken(activeToken);
  await assert.rejects(
    cancelInviteRecord(firestore, {
      teamId,
      inviteId: activeId,
      uid: 'member',
      now: Timestamp.fromMillis(3_000),
    }),
    (error) => error?.code === 'permission-denied',
  );
  await cancelInviteRecord(firestore, {
    teamId,
    inviteId: activeId,
    uid: 'admin',
    now: Timestamp.fromMillis(3_000),
  });
  await assert.rejects(
    consumeInviteRecord(firestore, {
      token: activeToken,
      uid: 'guest-3',
      displayName: 'Guest 3',
      email: 'guest-3@example.test',
      now: Timestamp.fromMillis(4_000),
    }),
    (error) => error?.details?.reason === 'canceled',
  );

  await createInviteRecord(firestore, {
    teamId,
    uid: 'admin',
    expiresAt: Timestamp.fromMillis(5_000),
    now: Timestamp.fromMillis(1_000),
    token: expiredToken,
  });
  await assert.rejects(
    consumeInviteRecord(firestore, {
      token: expiredToken,
      uid: 'guest-4',
      displayName: 'Guest 4',
      email: 'guest-4@example.test',
      now: Timestamp.fromMillis(5_000),
    }),
    (error) => error?.details?.reason === 'expired',
  );
  assert.equal((await firestore.doc(`teams/${teamId}/members/guest-3`).get()).exists, false);
  assert.equal((await firestore.doc(`teams/${teamId}/members/guest-4`).get()).exists, false);
});
