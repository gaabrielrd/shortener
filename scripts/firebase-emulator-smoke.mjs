import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const baseUrl = 'http://127.0.0.1:5000';
const app = initializeApp({ projectId: 'demo-shortener' }, 'firebase-smoke');
const firestore = getFirestore(app);

try {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: 'shortener-functions',
    status: 'ok',
  });

  const now = Timestamp.now();
  await Promise.all([
    firestore.doc('links/smoke-http').set({
      teamId: 'smoke-team',
      createdBy: 'smoke-owner',
      destinationUrl: 'http://example.test/http-destination',
      status: 'active',
      totalClicks: 0,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.doc('links/smoke-https').set({
      teamId: 'smoke-team',
      createdBy: 'smoke-owner',
      destinationUrl: 'https://example.test/https-destination',
      status: 'active',
      totalClicks: 0,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.doc('links/smoke-disabled').set({
      teamId: 'smoke-team',
      createdBy: 'smoke-owner',
      destinationUrl: 'https://example.test/private-destination',
      status: 'disabled',
      totalClicks: 0,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.doc('links/smoke-archived').set({
      teamId: 'smoke-team',
      createdBy: 'smoke-owner',
      destinationUrl: 'https://example.test/private-destination',
      status: 'archived',
      totalClicks: 0,
      createdAt: now,
      updatedAt: now,
    }),
    firestore.doc('links/smoke-invalid-counter').set({
      teamId: 'smoke-team',
      createdBy: 'smoke-owner',
      destinationUrl: 'https://example.test/must-not-redirect',
      status: 'active',
      totalClicks: -1,
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  const requestLink = (slug, init) => fetch(`${baseUrl}/${slug}`, { redirect: 'manual', ...init });
  const warm = await requestLink('smoke-http');
  assert.equal(warm.status, 302);
  assert.equal(warm.headers.get('location'), 'http://example.test/http-destination');

  const startedAt = performance.now();
  const measured = await requestLink('SMOKE-HTTP');
  const redirectLatencyMs = performance.now() - startedAt;
  assert.equal(measured.status, 302);
  assert.equal(measured.headers.get('location'), 'http://example.test/http-destination');
  assert.match(measured.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(measured.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(
    redirectLatencyMs <= 1_000,
    `Warm local redirect took ${redirectLatencyMs.toFixed(1)}ms, expected <= 1000ms`,
  );

  const secure = await requestLink('smoke-https');
  assert.equal(secure.status, 302);
  assert.equal(secure.headers.get('location'), 'https://example.test/https-destination');

  const [disabled, archived, missing] = await Promise.all([
    requestLink('smoke-disabled'),
    requestLink('smoke-archived'),
    requestLink('smoke-missing'),
  ]);
  assert.equal(disabled.status, 404);
  assert.equal(archived.status, 404);
  assert.equal(missing.status, 404);
  const unavailableHtml = await disabled.text();
  assert.equal(await archived.text(), unavailableHtml);
  assert.equal(await missing.text(), unavailableHtml);

  const failedCount = await requestLink('smoke-invalid-counter');
  assert.equal(failedCount.status, 503);
  assert.equal(failedCount.headers.get('location'), null);
  assert.equal(await failedCount.text(), unavailableHtml);

  const rejectedMethod = await requestLink('smoke-http', { method: 'POST' });
  assert.equal(rejectedMethod.status, 405);
  assert.equal(rejectedMethod.headers.get('allow'), 'GET');

  const todayUtc = new Date().toISOString().slice(0, 10);
  const httpLink = await firestore.doc('links/smoke-http').get();
  const httpsLink = await firestore.doc('links/smoke-https').get();
  assert.equal(httpLink.get('totalClicks'), 2);
  assert.equal(httpsLink.get('totalClicks'), 1);
  assert.equal(
    (await firestore.doc(`links/smoke-http/dailyClicks/${todayUtc}`).get()).get('count'),
    2,
  );
  assert.equal((await firestore.doc('links/smoke-disabled').get()).get('totalClicks'), 0);
  assert.equal((await firestore.collection('links/smoke-disabled/dailyClicks').get()).empty, true);
  assert.equal(
    (await firestore.collection('links/smoke-invalid-counter/dailyClicks').get()).empty,
    true,
  );

  for (const path of ['/', '/login', '/styleguide', '/app', '/app/equipes/team', '/invite/token']) {
    const spa = await fetch(`${baseUrl}${path}`);
    assert.equal(spa.status, 200, `${path} must remain a SPA route`);
    assert.match(await spa.text(), /<div id="root"><\/div>/);
  }
  const asset = await fetch(`${baseUrl}/favicon.svg`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type') ?? '', /image\/svg\+xml/);

  console.log(
    `Smoke Firebase OK; warm redirect latency ${redirectLatencyMs.toFixed(1)}ms (local emulator).`,
  );
} finally {
  await deleteApp(app);
}
