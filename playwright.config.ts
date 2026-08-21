import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';
import { env } from './src/config/env';

/**
 * `list` everywhere, GitHub annotations in CI. A sharded run emits `blob` only - each shard
 * sees a slice of the suite, so HTML/JUnit are produced once by `merge-reports` over all of
 * them. Every other run writes its own HTML and JUnit report directly.
 */
const reporter: ReporterDescription[] = [['list']];
if (env.isCI) reporter.push(['github']);
if (env.blobReport) {
  reporter.push(['blob']);
} else {
  reporter.push(['html', { outputFolder: 'playwright-report', open: 'never' }]);
  reporter.push(['junit', { outputFile: 'test-results/junit.xml' }]);
}

/**
 * OrangeHRM demo - Playwright + TypeScript framework.
 *
 * Project layout:
 *  - `setup`         logs in once and stores the session for reuse.
 *  - `guest`         tests that must start unauthenticated (login, logout, guards).
 *  - `<browser>`     authenticated suites, seeded from the stored session.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.retries,
  workers: env.workers,
  timeout: env.timeouts.test,
  expect: {
    timeout: env.timeouts.expect,
  },
  reporter,
  use: {
    baseURL: env.baseUrl,
    headless: env.headless,
    launchOptions: { slowMo: env.slowMo },
    actionTimeout: env.timeouts.action,
    navigationTimeout: env.timeouts.navigation,
    trace: env.trace,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1536, height: 864 },
    ignoreHTTPSErrors: true,
    testIdAttribute: 'data-testid',
  },
  projects: [
    {
      name: 'setup',
      // global.setup.ts lives at the repo root, outside the shared testDir.
      testDir: '.',
      testMatch: /global\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Unauthenticated by design - no stored session, no setup dependency.
      name: 'guest',
      testDir: './tests/auth',
      use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'chromium',
      testIgnore: /tests\/auth\//,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: env.storageStatePath },
    },
    // Cross-browser coverage is opt-in so the default run stays fast:
    //   ALL_BROWSERS=true npx playwright test      (or --project=firefox)
    ...(['1', 'true', 'yes'].includes((process.env.ALL_BROWSERS ?? '').toLowerCase())
      ? [
          {
            name: 'firefox',
            testIgnore: /tests\/auth\//,
            dependencies: ['setup'],
            use: { ...devices['Desktop Firefox'], storageState: env.storageStatePath },
          },
          {
            name: 'webkit',
            testIgnore: /tests\/auth\//,
            dependencies: ['setup'],
            use: { ...devices['Desktop Safari'], storageState: env.storageStatePath },
          },
        ]
      : []),
  ],
});
