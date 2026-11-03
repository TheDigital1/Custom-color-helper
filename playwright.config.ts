import { defineConfig, devices } from '@playwright/test';

// The e2e run builds the app against the synthetic fixture data in tests/fixtures,
// so it never depends on (or overwrites) the real data in public/data.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4173/' },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command:
      'tsx scripts/build-data.ts --sources tests/fixtures/sources.json --out .e2e/public/data && ' +
      'PUBLIC_DIR=.e2e/public vite build --outDir .e2e/dist --emptyOutDir && ' +
      'vite preview --outDir .e2e/dist --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
