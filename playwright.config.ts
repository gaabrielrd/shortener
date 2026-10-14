import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { defineConfig, devices } from '@playwright/test';

// Controles nativos e fontes de reserva variam também entre distribuições Linux.
const osRelease =
  process.platform === 'linux' && existsSync('/etc/os-release')
    ? readFileSync('/etc/os-release', 'utf8')
    : '';
const distribution = osRelease.match(/^ID="?([^"\n]+)"?$/m)?.[1];
const version = osRelease.match(/^VERSION_ID="?([^"\n]+)"?$/m)?.[1];
const snapshotPlatform =
  distribution && version
    ? `linux-${distribution}-${version}`.replace(/[^a-zA-Z0-9.-]/g, '-')
    : process.platform;

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Não foi possível reservar uma porta para o teste E2E.'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

const port = process.env.PLAYWRIGHT_E2E_PORT
  ? Number(process.env.PLAYWRIGHT_E2E_PORT)
  : await availablePort();
process.env.PLAYWRIGHT_E2E_PORT = String(port);
const baseURL = `http://127.0.0.1:${port}`;

// O navegador E2E usa somente o projeto demo e a pilha local Firebase.
process.env.VITE_FIREBASE_API_KEY = 'e2e-public-key';
process.env.VITE_FIREBASE_AUTH_DOMAIN = 'demo-shortener.firebaseapp.com';
process.env.VITE_FIREBASE_PROJECT_ID = 'demo-shortener';
process.env.VITE_FIREBASE_STORAGE_BUCKET = 'demo-shortener.firebasestorage.app';
process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '000000000000';
process.env.VITE_FIREBASE_APP_ID = '1:000000000000:web:e2e';
process.env.VITE_FIREBASE_USE_EMULATORS = 'true';
process.env.VITE_PUBLIC_SHORT_BASE_URL = baseURL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Imagens por plataforma e distribuição: os controles e fontes nativos
  // do Debian local não servem como referência do Ubuntu usado pelo CI.
  snapshotPathTemplate: `{testDir}/__screenshots__/${snapshotPlatform}/{arg}{ext}`,
  expect: {
    // Estreito de propósito: na mesma plataforma a renderização é
    // determinística, e uma tolerância folgada deixaria passar troca de cor
    // em elementos pequenos numa página longa.
    toHaveScreenshot: { maxDiffPixelRatio: 0.0005 },
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /app\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: [
    {
      command:
        'npm run build:functions && firebase emulators:start --project demo-shortener --only auth,firestore,functions',
      url: 'http://127.0.0.1:9099/emulator/v1/projects/demo-shortener/config',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run build:bundle && npx vite preview --host 127.0.0.1 --port ${port}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
