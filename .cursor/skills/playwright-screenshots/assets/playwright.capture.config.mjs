// Minimal Playwright config for .docs-capture/ — copied into the target repo on first capture.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.capture.spec.mjs',
  timeout: 120_000,
  use: {
    baseURL: process.env.DOCS_CAPTURE_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 720 },
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  reporter: [['list']],
});
