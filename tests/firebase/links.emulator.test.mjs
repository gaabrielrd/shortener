import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  createLinkRecord,
  normalizeDestinationUrl,
  normalizeLinkSlug,
  updateLinkRecord,
} from '../../functions/lib/links.js';
import { resolveAndCountRedirect } from '../../functions/lib/redirect.js';

const projectId = 'demo-shortener';
const app = initializeApp({ projectId }, 'links-emulator-tests');
const firestore = getFirestore(app);
const teamId = `links-${Date.now()}`;

before(async () => {
  const team = firestore.collection('teams').doc(teamId);
  const batch = firestore.batch();
  batch.set(team, { id: teamId, name: 'Equipe de links' });
  batch.set(team.collection('members').doc('admin'), { uid: 'admin', teamId, role: 'admin' });
  batch.set(team.collection('members').doc('member'), { uid: 'member', teamId, role: 'member' });
  await batch.commit();
});

after(async () => {
  await deleteApp(app);
});

test('membro cria link e histórico na mesma operação', async () => {
  const now = Timestamp.fromMillis(1_000);
  const link = await createLinkRecord(firestore, {
    teamId,
    uid: 'member',
    slug: normalizeLinkSlug('Campanha-2026'),
    destinationUrl: normalizeDestinationUrl('http://example.com/campanha'),
    now,
  });
  assert.equal(link.createdBy, 'member');
  assert.equal(link.totalClicks, 0);
  const persisted = await firestore.doc('links/campanha-2026').get();
  assert.equal(persisted.get('teamId'), teamId);
  const history = await persisted.ref.collection('history').get();
  assert.equal(history.size, 1);
  assert.equal(history.docs[0]?.get('action'), 'created');
  assert.equal(history.docs[0]?.get('nextValue'), 'http://example.com/campanha');
});

test('duas reservas concorrentes e variação de caixa produzem um único vencedor', async () => {
  const create = (uid, destinationUrl) =>
    createLinkRecord(firestore, {
      teamId,
      uid,
      slug: normalizeLinkSlug('LANCAMENTO'),
      destinationUrl,
      now: Timestamp.fromMillis(2_000),
    });
  const results = await Promise.allSettled([
    create('admin', 'https://example.com/admin'),
    create('member', 'https://example.com/member'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const persisted = await firestore.doc('links/lancamento').get();
  assert.equal(persisted.exists, true);
  assert.equal((await persisted.ref.collection('history').get()).size, 1);
});

test('pessoa externa não cria link na equipe', async () => {
  await assert.rejects(
    createLinkRecord(firestore, {
      teamId,
      uid: 'outsider',
      slug: 'externo',
      destinationUrl: 'https://example.com/',
      now: Timestamp.fromMillis(3_000),
    }),
    (error) => error?.code === 'permission-denied',
  );
  assert.equal((await firestore.doc('links/externo').get()).exists, false);
});

test('edição e estados preservam slug, cliques e registram somente mudanças reais', async () => {
  const slug = 'ciclo-de-vida';
  await createLinkRecord(firestore, {
    teamId,
    uid: 'member',
    slug,
    destinationUrl: 'https://example.com/antes',
    now: Timestamp.fromMillis(4_000),
  });
  await firestore.doc(`links/${slug}`).update({ totalClicks: 17 });

  const edited = await updateLinkRecord(firestore, {
    teamId,
    uid: 'member',
    slug,
    now: Timestamp.fromMillis(5_000),
    change: { type: 'destination', destinationUrl: 'http://example.com/depois' },
  });
  assert.equal(edited.changed, true);
  assert.equal(edited.link.totalClicks, 17);

  const [firstDisable, secondDisable] = await Promise.all([
    updateLinkRecord(firestore, {
      teamId,
      uid: 'member',
      slug,
      now: Timestamp.fromMillis(6_000),
      change: { type: 'status', command: 'disable' },
    }),
    updateLinkRecord(firestore, {
      teamId,
      uid: 'admin',
      slug,
      now: Timestamp.fromMillis(6_001),
      change: { type: 'status', command: 'disable' },
    }),
  ]);
  assert.equal([firstDisable.changed, secondDisable.changed].filter(Boolean).length, 1);
  await updateLinkRecord(firestore, {
    teamId,
    uid: 'admin',
    slug,
    now: Timestamp.fromMillis(7_000),
    change: { type: 'status', command: 'archive' },
  });
  await updateLinkRecord(firestore, {
    teamId,
    uid: 'member',
    slug,
    now: Timestamp.fromMillis(8_000),
    change: { type: 'status', command: 'restore' },
  });

  const persisted = await firestore.doc(`links/${slug}`).get();
  assert.equal(persisted.id, slug);
  assert.equal(persisted.get('destinationUrl'), 'http://example.com/depois');
  assert.equal(persisted.get('status'), 'active');
  assert.equal(persisted.get('totalClicks'), 17);
  const history = await persisted.ref.collection('history').orderBy('createdAt').get();
  assert.deepEqual(
    history.docs.map((entry) => entry.get('action')),
    ['created', 'destination_changed', 'disabled', 'archived', 'restored'],
  );
});

test('administrador altera qualquer link, mas outro membro e pessoa externa são negados', async () => {
  const slug = 'autorizacao-link';
  await createLinkRecord(firestore, {
    teamId,
    uid: 'member',
    slug,
    destinationUrl: 'https://example.com/',
    now: Timestamp.fromMillis(9_000),
  });
  const secondMember = firestore.doc(`teams/${teamId}/members/member-2`);
  await secondMember.set({ uid: 'member-2', teamId, role: 'member' });
  for (const uid of ['member-2', 'outsider']) {
    await assert.rejects(
      updateLinkRecord(firestore, {
        teamId,
        uid,
        slug,
        now: Timestamp.fromMillis(10_000),
        change: { type: 'status', command: 'archive' },
      }),
      (error) => error?.code === 'permission-denied',
    );
  }
  assert.equal(
    (
      await updateLinkRecord(firestore, {
        teamId,
        uid: 'admin',
        slug,
        now: Timestamp.fromMillis(11_000),
        change: { type: 'status', command: 'archive' },
      })
    ).changed,
    true,
  );
});

test('cada redirecionamento ativo conta total e dia UTC para destinos HTTP e HTTPS', async () => {
  const cases = [
    ['clique-http', 'http://example.com/inseguro'],
    ['clique-https', 'https://example.com/seguro'],
  ];
  for (const [slug, destinationUrl] of cases) {
    await createLinkRecord(firestore, {
      teamId,
      uid: 'member',
      slug,
      destinationUrl,
      now: Timestamp.fromMillis(12_000),
    });
    const first = await resolveAndCountRedirect(firestore, {
      slug,
      now: Timestamp.fromDate(new Date('2026-08-15T23:59:59.999Z')),
    });
    const second = await resolveAndCountRedirect(firestore, {
      slug,
      now: Timestamp.fromDate(new Date('2026-08-16T00:00:00.000Z')),
    });
    assert.deepEqual(first, { kind: 'redirect', destinationUrl });
    assert.deepEqual(second, { kind: 'redirect', destinationUrl });

    const persisted = await firestore.doc(`links/${slug}`).get();
    assert.equal(persisted.get('totalClicks'), 2);
    const daily = await persisted.ref.collection('dailyClicks').orderBy('dayUtc').get();
    assert.deepEqual(
      daily.docs.map((entry) => [entry.id, entry.get('count')]),
      [
        ['2026-08-15', 1],
        ['2026-08-16', 1],
      ],
    );
    for (const entry of daily.docs) {
      assert.deepEqual(Object.keys(entry.data()).sort(), ['count', 'dayUtc', 'updatedAt']);
    }
  }
});

test('alterar o destino preserva total e série diária anteriores', async () => {
  const slug = 'analytics-preservado';
  await createLinkRecord(firestore, {
    teamId,
    uid: 'member',
    slug,
    destinationUrl: 'https://example.com/antes',
    now: Timestamp.fromMillis(12_500),
  });
  const clickTime = Timestamp.fromDate(new Date('2026-08-15T12:00:00.000Z'));
  await resolveAndCountRedirect(firestore, { slug, now: clickTime });
  await updateLinkRecord(firestore, {
    teamId,
    uid: 'member',
    slug,
    now: Timestamp.fromMillis(12_600),
    change: { type: 'destination', destinationUrl: 'http://example.com/depois' },
  });
  const result = await resolveAndCountRedirect(firestore, { slug, now: clickTime });
  assert.deepEqual(result, {
    kind: 'redirect',
    destinationUrl: 'http://example.com/depois',
  });
  assert.equal((await firestore.doc(`links/${slug}`).get()).get('totalClicks'), 2);
  assert.equal((await firestore.doc(`links/${slug}/dailyClicks/2026-08-15`).get()).get('count'), 2);
});

test('inexistente, desativado e arquivado são indisponíveis sem gerar contagem', async () => {
  for (const [slug, status] of [
    ['clique-desativado', 'disabled'],
    ['clique-arquivado', 'archived'],
  ]) {
    await createLinkRecord(firestore, {
      teamId,
      uid: 'member',
      slug,
      destinationUrl: 'https://example.com/',
      now: Timestamp.fromMillis(13_000),
    });
    await firestore.doc(`links/${slug}`).update({ status });
  }

  for (const slug of ['clique-inexistente', 'clique-desativado', 'clique-arquivado']) {
    assert.deepEqual(
      await resolveAndCountRedirect(firestore, {
        slug,
        now: Timestamp.fromDate(new Date('2026-08-15T12:00:00.000Z')),
      }),
      { kind: 'unavailable' },
    );
    const daily = await firestore.collection(`links/${slug}/dailyClicks`).get();
    assert.equal(daily.empty, true);
  }
  assert.equal((await firestore.doc('links/clique-desativado').get()).get('totalClicks'), 0);
  assert.equal((await firestore.doc('links/clique-arquivado').get()).get('totalClicks'), 0);
});

test('cliques concorrentes não perdem incrementos nem criam eventos individuais', async () => {
  const slug = 'cliques-concorrentes';
  await createLinkRecord(firestore, {
    teamId,
    uid: 'member',
    slug,
    destinationUrl: 'https://example.com/carga',
    now: Timestamp.fromMillis(14_000),
  });
  const now = Timestamp.fromDate(new Date('2026-08-15T12:00:00.000Z'));
  const results = await Promise.all(
    Array.from({ length: 8 }, () => resolveAndCountRedirect(firestore, { slug, now })),
  );
  assert.equal(results.filter((result) => result.kind === 'redirect').length, 8);

  const persisted = await firestore.doc(`links/${slug}`).get();
  assert.equal(persisted.get('totalClicks'), 8);
  assert.equal((await firestore.doc(`links/${slug}/dailyClicks/2026-08-15`).get()).get('count'), 8);
  const subcollections = await persisted.ref.listCollections();
  assert.deepEqual(subcollections.map((collection) => collection.id).sort(), [
    'dailyClicks',
    'history',
  ]);
});
