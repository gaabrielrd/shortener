import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));

test('não mantém HTML da SPA obsoleto sem desabilitar cache de assets e redirects', () => {
  const cacheRule = config.hosting.headers.find((rule) =>
    rule.headers.some((header) => header.key.toLowerCase() === 'cache-control'),
  );

  assert.ok(cacheRule?.regex, 'firebase.json deve declarar o cache das rotas SPA');
  const routes = new RegExp(cacheRule.regex);
  for (const path of [
    '/',
    '/index.html',
    '/login',
    '/styleguide',
    '/app',
    '/app/links',
    '/invite/x',
  ]) {
    assert.equal(routes.test(path), true, `${path} deve revalidar o HTML`);
  }
  for (const path of ['/assets/index.js', '/favicon.svg', '/api/health', '/slug-publico']) {
    assert.equal(routes.test(path), false, `${path} não deve herdar o cache do HTML`);
  }

  assert.deepEqual(cacheRule.headers, [
    {
      key: 'Cache-Control',
      value: 'no-cache, no-store, must-revalidate',
    },
  ]);
});
