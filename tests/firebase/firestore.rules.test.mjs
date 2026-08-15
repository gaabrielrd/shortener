import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

const projectId = 'demo-shortener';
let testEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
    },
  });

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alice'), {
      uid: 'alice',
      displayName: 'Alice',
      email: 'alice@example.test',
    });
    await setDoc(doc(context.firestore(), 'teams/team-a'), { id: 'team-a', name: 'Equipe A' });
    await setDoc(doc(context.firestore(), 'teams/team-b'), { id: 'team-b', name: 'Equipe B' });
    await setDoc(doc(context.firestore(), 'teams/team-c'), { id: 'team-c', name: 'Equipe C' });
    await setDoc(doc(context.firestore(), 'teams/team-a/members/alice'), {
      uid: 'alice',
      teamId: 'team-a',
      role: 'admin',
    });
    await setDoc(doc(context.firestore(), 'teams/team-b/members/bob'), {
      uid: 'bob',
      teamId: 'team-b',
      role: 'admin',
    });
    await setDoc(doc(context.firestore(), 'teams/team-c/members/alice'), {
      uid: 'alice',
      teamId: 'team-c',
      role: 'member',
    });
    await setDoc(doc(context.firestore(), 'teams/team-a/members/charlie'), {
      uid: 'charlie',
      teamId: 'team-a',
      role: 'member',
    });
    await setDoc(doc(context.firestore(), 'teams/team-d'), { id: 'team-d', name: 'Equipe D' });
    await setDoc(doc(context.firestore(), 'teams/team-d/members/charlie'), {
      uid: 'charlie',
      teamId: 'team-d',
      role: 'member',
    });
    await setDoc(doc(context.firestore(), 'inviteTokens/invite-a'), {
      teamId: 'team-a',
      createdBy: 'alice',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      canceledAt: null,
      role: 'member',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await setDoc(doc(context.firestore(), 'links/alice-link'), {
      teamId: 'team-a',
      createdBy: 'alice',
      destinationUrl: 'https://example.com/alice',
      status: 'active',
      totalClicks: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await setDoc(doc(context.firestore(), 'links/charlie-link'), {
      teamId: 'team-a',
      createdBy: 'charlie',
      destinationUrl: 'http://example.com/charlie',
      status: 'active',
      totalClicks: 0,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await setDoc(doc(context.firestore(), 'links/alice-link/history/created'), {
      action: 'created',
      actorId: 'alice',
      previousValue: null,
      nextValue: 'https://example.com/alice',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await setDoc(doc(context.firestore(), 'links/charlie-link/history/created'), {
      action: 'created',
      actorId: 'charlie',
      previousValue: null,
      nextValue: 'http://example.com/charlie',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await setDoc(doc(context.firestore(), 'links/alice-link/dailyClicks/2026-01-01'), {
      dayUtc: '2026-01-01',
      count: 2,
      updatedAt: new Date('2026-01-01T12:00:00.000Z'),
    });
    await setDoc(doc(context.firestore(), 'links/charlie-link/dailyClicks/2026-01-02'), {
      dayUtc: '2026-01-02',
      count: 3,
      updatedAt: new Date('2026-01-02T12:00:00.000Z'),
    });
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

test('an authenticated user can read only their own profile', async () => {
  const googleClaim = { firebase: { sign_in_provider: 'google.com' } };
  const alice = testEnvironment.authenticatedContext('alice', googleClaim).firestore();
  const bob = testEnvironment.authenticatedContext('bob', googleClaim).firestore();
  const passwordAlice = testEnvironment
    .authenticatedContext('alice', { firebase: { sign_in_provider: 'password' } })
    .firestore();

  await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  await assertFails(getDoc(doc(bob, 'users/alice')));
  await assertFails(getDoc(doc(passwordAlice, 'users/alice')));
});

test('clients cannot write profiles or unknown collections', async () => {
  const alice = testEnvironment
    .authenticatedContext('alice', { firebase: { sign_in_provider: 'google.com' } })
    .firestore();

  await assertFails(setDoc(doc(alice, 'users/alice'), { displayName: 'Changed' }));
  await assertFails(setDoc(doc(alice, 'teams/team-a'), { name: 'Team A' }));
});

test('a pessoa consulta somente as próprias associações e equipes', async () => {
  const googleClaim = { firebase: { sign_in_provider: 'google.com' } };
  const alice = testEnvironment.authenticatedContext('alice', googleClaim).firestore();

  const memberships = query(collectionGroup(alice, 'members'), where('uid', '==', 'alice'));
  const snapshot = await assertSucceeds(getDocs(memberships));
  const teamIds = snapshot.docs.map((item) => item.data().teamId).sort();
  assert.deepEqual(teamIds, ['team-a', 'team-c']);

  await assertSucceeds(getDoc(doc(alice, 'teams/team-a')));
  await assertSucceeds(getDoc(doc(alice, 'teams/team-c')));
  await assertFails(getDoc(doc(alice, 'teams/team-b')));
  await assertFails(getDocs(collection(alice, 'teams')));
});

test('associações e equipes não aceitam escrita direta do cliente', async () => {
  const alice = testEnvironment
    .authenticatedContext('alice', { firebase: { sign_in_provider: 'google.com' } })
    .firestore();

  await assertFails(
    setDoc(doc(alice, 'teams/team-a/members/alice'), {
      uid: 'alice',
      teamId: 'team-a',
      role: 'member',
    }),
  );
});

test('membros da equipe veem a lista completa, mas pessoas externas não', async () => {
  const googleClaim = { firebase: { sign_in_provider: 'google.com' } };
  const alice = testEnvironment.authenticatedContext('alice', googleClaim).firestore();
  const charlie = testEnvironment.authenticatedContext('charlie', googleClaim).firestore();
  const bob = testEnvironment.authenticatedContext('bob', googleClaim).firestore();
  const passwordCharlie = testEnvironment
    .authenticatedContext('charlie', { firebase: { sign_in_provider: 'password' } })
    .firestore();

  const aliceMembers = await assertSucceeds(getDocs(collection(alice, 'teams/team-a/members')));
  const charlieMembers = await assertSucceeds(getDocs(collection(charlie, 'teams/team-a/members')));
  assert.equal(aliceMembers.size, 2);
  assert.equal(charlieMembers.size, 2);
  await assertFails(getDocs(collection(bob, 'teams/team-a/members')));
  await assertFails(getDocs(collection(passwordCharlie, 'teams/team-a/members')));
});

test('a remoção revoga imediatamente a leitura da equipe', async () => {
  const googleClaim = { firebase: { sign_in_provider: 'google.com' } };
  const charlie = testEnvironment.authenticatedContext('charlie', googleClaim).firestore();

  await assertSucceeds(getDoc(doc(charlie, 'teams/team-d')));
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), 'teams/team-d/members/charlie'));
  });

  await assertFails(getDoc(doc(charlie, 'teams/team-d')));
  await assertFails(getDocs(collection(charlie, 'teams/team-d/members')));
});

test('somente administrador lista convites da própria equipe e ninguém escreve', async () => {
  const googleClaim = { firebase: { sign_in_provider: 'google.com' } };
  const alice = testEnvironment.authenticatedContext('alice', googleClaim).firestore();
  const charlie = testEnvironment.authenticatedContext('charlie', googleClaim).firestore();
  const bob = testEnvironment.authenticatedContext('bob', googleClaim).firestore();

  const ownInvites = query(collection(alice, 'inviteTokens'), where('teamId', '==', 'team-a'));
  assert.equal((await assertSucceeds(getDocs(ownInvites))).size, 1);
  await assertFails(
    getDocs(query(collection(charlie, 'inviteTokens'), where('teamId', '==', 'team-a'))),
  );
  await assertFails(
    getDocs(query(collection(bob, 'inviteTokens'), where('teamId', '==', 'team-a'))),
  );
  await assertFails(setDoc(doc(alice, 'inviteTokens/client-write'), { teamId: 'team-a' }));
});

test('administrador lista a equipe e membro consulta somente os links que criou', async () => {
  const googleClaim = { firebase: { sign_in_provider: 'google.com' } };
  const alice = testEnvironment.authenticatedContext('alice', googleClaim).firestore();
  const charlie = testEnvironment.authenticatedContext('charlie', googleClaim).firestore();
  const bob = testEnvironment.authenticatedContext('bob', googleClaim).firestore();

  const adminQuery = query(collection(alice, 'links'), where('teamId', '==', 'team-a'));
  assert.equal((await assertSucceeds(getDocs(adminQuery))).size, 2);

  const memberQuery = query(
    collection(charlie, 'links'),
    where('teamId', '==', 'team-a'),
    where('createdBy', '==', 'charlie'),
  );
  const ownLinks = await assertSucceeds(getDocs(memberQuery));
  assert.deepEqual(
    ownLinks.docs.map((item) => item.id),
    ['charlie-link'],
  );
  await assertFails(getDocs(query(collection(charlie, 'links'), where('teamId', '==', 'team-a'))));
  await assertFails(getDoc(doc(charlie, 'links/alice-link')));
  await assertFails(getDocs(query(collection(bob, 'links'), where('teamId', '==', 'team-a'))));
});

test('clientes não gravam links ou histórico diretamente', async () => {
  const alice = testEnvironment
    .authenticatedContext('alice', { firebase: { sign_in_provider: 'google.com' } })
    .firestore();
  await assertFails(setDoc(doc(alice, 'links/client-write'), { teamId: 'team-a' }));
  await assertFails(
    setDoc(doc(alice, 'links/alice-link/history/client-write'), { action: 'created' }),
  );
});

test('histórico é visível somente ao criador ou administrador e permanece imutável', async () => {
  const googleClaim = { firebase: { sign_in_provider: 'google.com' } };
  const alice = testEnvironment.authenticatedContext('alice', googleClaim).firestore();
  const charlie = testEnvironment.authenticatedContext('charlie', googleClaim).firestore();
  const bob = testEnvironment.authenticatedContext('bob', googleClaim).firestore();

  assert.equal(
    (await assertSucceeds(getDocs(collection(alice, 'links/charlie-link/history')))).size,
    1,
  );
  assert.equal(
    (await assertSucceeds(getDocs(collection(charlie, 'links/charlie-link/history')))).size,
    1,
  );
  await assertFails(getDocs(collection(charlie, 'links/alice-link/history')));
  await assertFails(getDocs(collection(bob, 'links/charlie-link/history')));
  await assertFails(
    setDoc(doc(charlie, 'links/charlie-link/history/client-change'), { action: 'archived' }),
  );
  await assertFails(deleteDoc(doc(charlie, 'links/charlie-link/history/created')));
});

test('analytics é visível somente ao criador ou administrador e permanece agregado', async () => {
  const googleClaim = { firebase: { sign_in_provider: 'google.com' } };
  const alice = testEnvironment.authenticatedContext('alice', googleClaim).firestore();
  const charlie = testEnvironment.authenticatedContext('charlie', googleClaim).firestore();
  const bob = testEnvironment.authenticatedContext('bob', googleClaim).firestore();

  assert.equal(
    (await assertSucceeds(getDocs(collection(alice, 'links/charlie-link/dailyClicks')))).size,
    1,
  );
  assert.equal(
    (await assertSucceeds(getDocs(collection(charlie, 'links/charlie-link/dailyClicks')))).size,
    1,
  );
  await assertFails(getDocs(collection(charlie, 'links/alice-link/dailyClicks')));
  await assertFails(getDocs(collection(bob, 'links/charlie-link/dailyClicks')));
  await assertFails(
    setDoc(doc(charlie, 'links/charlie-link/dailyClicks/2026-01-03'), {
      dayUtc: '2026-01-03',
      count: 100,
    }),
  );
});
