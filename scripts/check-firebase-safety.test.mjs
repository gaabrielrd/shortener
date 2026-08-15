import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkFirebaseSafety } from './check-firebase-safety.mjs';

function fixture(command, source = '') {
  const root = mkdtempSync(join(tmpdir(), 'firebase-safety-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ scripts: { 'test:firebase': command } }),
  );
  writeFileSync(join(root, '.gitignore'), '.env.local\n.env.*.local\n');
  writeFileSync(join(root, 'src', 'client.ts'), source);
  return root;
}

test('aceita emuladores explicitamente isolados no projeto demo', () => {
  const root = fixture('firebase emulators:exec --project demo-shortener "node --test"');
  try {
    assert.deepEqual(checkFirebaseSafety(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('recusa emulador sem demo e identificador real em código executável', () => {
  const realProject = ['shortener', '59c85'].join('-');
  const root = fixture('firebase emulators:exec "node --test"', realProject);
  try {
    assert.match(checkFirebaseSafety(root).join('\n'), /sem --project demo-shortener/);
    assert.match(checkFirebaseSafety(root).join('\n'), /identificador real proibido/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
