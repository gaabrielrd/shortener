import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applyMembershipCommand } from '../../functions/lib/members.js';

const projectId = 'demo-shortener';
const app = initializeApp({ projectId }, 'members-emulator-tests');
const firestore = getFirestore(app);
const runId = `members-${Date.now()}`;
const teamId = `${runId}-team`;
const linkSlug = `${runId}-link`;

before(async () => {
  const team = firestore.collection('teams').doc(teamId);
  const batch = firestore.batch();
  batch.set(team, { id: teamId, name: 'Equipe concorrente' });
  batch.set(team.collection('members').doc('admin-a'), {
    uid: 'admin-a',
    teamId,
    role: 'admin',
    displayName: 'Admin A',
    email: 'admin-a@example.test',
  });
  batch.set(team.collection('members').doc('admin-b'), {
    uid: 'admin-b',
    teamId,
    role: 'admin',
    displayName: 'Admin B',
    email: 'admin-b@example.test',
  });
  batch.set(team.collection('members').doc('member-c'), {
    uid: 'member-c',
    teamId,
    role: 'member',
    displayName: 'Member C',
    email: 'member-c@example.test',
  });
  batch.set(firestore.collection('links').doc(linkSlug), {
    teamId,
    createdBy: 'member-c',
    destinationUrl: 'https://example.test',
    status: 'active',
    totalClicks: 0,
  });
  await batch.commit();
});

after(async () => {
  await deleteApp(app);
});

test('duas reduções concorrentes preservam exatamente um administrador', async () => {
  const results = await Promise.allSettled([
    applyMembershipCommand(firestore, 'admin-a', {
      action: 'change-role',
      teamId,
      targetUid: 'admin-a',
      role: 'member',
    }),
    applyMembershipCommand(firestore, 'admin-b', {
      action: 'change-role',
      teamId,
      targetUid: 'admin-b',
      role: 'member',
    }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected?.status, 'rejected');
  if (rejected?.status === 'rejected') {
    assert.equal(rejected.reason?.details?.reason, 'last-admin');
  }

  const members = await firestore.collection('teams').doc(teamId).collection('members').get();
  const administrators = members.docs.filter((member) => member.get('role') === 'admin');
  assert.equal(administrators.length, 1);
});

test('membro comum não remove e remoção administrativa preserva links da equipe', async () => {
  const members = firestore.collection('teams').doc(teamId).collection('members');
  const administrators = await members.where('role', '==', 'admin').get();
  const administratorId = administrators.docs[0]?.id;
  assert.ok(administratorId);

  await assert.rejects(
    applyMembershipCommand(firestore, 'member-c', {
      action: 'remove',
      teamId,
      targetUid: administratorId,
    }),
    (error) => error?.code === 'permission-denied',
  );

  await applyMembershipCommand(firestore, administratorId, {
    action: 'remove',
    teamId,
    targetUid: 'member-c',
  });
  assert.equal((await members.doc('member-c').get()).exists, false);

  const link = await firestore.collection('links').doc(linkSlug).get();
  assert.equal(link.exists, true);
  assert.equal(link.get('teamId'), teamId);
  assert.equal(link.get('createdBy'), 'member-c');
});
