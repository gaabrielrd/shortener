import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      env: {
        VITE_FIREBASE_API_KEY: 'test-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'demo-shortener.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'demo-shortener',
        VITE_FIREBASE_STORAGE_BUCKET: 'demo-shortener.firebasestorage.app',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
        VITE_FIREBASE_APP_ID: '1:000000000000:web:test',
        VITE_FIREBASE_USE_EMULATORS: 'true',
      },
      globals: true,
      setupFiles: './src/test/setup.ts',
      exclude: [
        ...configDefaults.exclude,
        'scripts/**/*.test.mjs',
        'tests/**/*.test.mjs',
        'functions/**',
        'e2e/**',
      ],
      css: true,
      typecheck: {
        tsconfig: './tsconfig.app.json',
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/test/**',
          'src/**/tests/**',
          'src/main.tsx',
          'src/app/providers/**',
          'src/vite-env.d.ts',
        ],
        // Aplicados de fato: `npm run test` roda `test:coverage`, entao uma
        // queda abaixo destes limites falha o `validate` e o CI.
        thresholds: {
          statements: 85,
          lines: 85,
          branches: 75,
          functions: 90,
        },
      },
    },
  }),
);
