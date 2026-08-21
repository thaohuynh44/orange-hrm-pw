import { test as base, type Page } from '@playwright/test';

/**
 * Extra browser sessions.
 *
 * A fixture belongs here when it owns a browser context of its own - it opens one, hands
 * out a page, and closes it again on teardown. The chrome a spec needs to *read* such a
 * page is a separate concern: see `chrome.fixture.ts`.
 */
export interface SessionFixtures {
  /**
   * A page in its own signed-out browser context.
   *
   * Flows that cross roles use this for the second actor, so the admin session in `page`
   * stays alive alongside it. Closed automatically after the test.
   */
  secondSession: Page;
}

export const sessionTest = base.extend<SessionFixtures>({
  secondSession: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
