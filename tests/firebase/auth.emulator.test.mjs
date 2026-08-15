import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from 'firebase/auth';

const app = initializeApp(
  {
    apiKey: 'emulator-public-key',
    authDomain: 'demo-shortener.firebaseapp.com',
    projectId: 'demo-shortener',
  },
  `auth-rules-${Date.now()}`,
);
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

after(async () => {
  await deleteApp(app);
});

test('Auth Emulator cria sessão local e confirma logout', async () => {
  const credential = await createUserWithEmailAndPassword(
    auth,
    `session-${Date.now()}@example.test`,
    'local-test-password',
  );

  assert.equal(auth.currentUser?.uid, credential.user.uid);
  assert.equal(credential.user.isAnonymous, false);

  await signOut(auth);
  assert.equal(auth.currentUser, null);
});
