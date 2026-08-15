import { spawnSync } from 'node:child_process';

const testFiles = [
  'tests/firebase/auth.emulator.test.mjs',
  'tests/firebase/firestore.rules.test.mjs',
  'tests/firebase/members.emulator.test.mjs',
  'tests/firebase/invites.emulator.test.mjs',
  'tests/firebase/links.emulator.test.mjs',
];

const tests = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...testFiles], {
  stdio: 'inherit',
});
if (tests.error !== undefined) throw tests.error;
if (tests.status !== 0) process.exit(tests.status ?? 1);

await import('./firebase-emulator-smoke.mjs');
