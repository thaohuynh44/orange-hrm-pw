import { test as base, type Page } from '@playwright/test';
import { AppChrome } from '../core/app.chrome';

/**
 * Fixtures for the pages that no page object owns.
 *
 * Both of these exist for the same situation: a `Page` that is not one of the app's
 * screens - a second actor's session, or a route asserted to be refused - which a spec
 * still has to navigate and read. They are session plumbing rather than screens, so they
 * are declared here and not in `pages.fixture.ts`.
 */
export interface SessionFixtures {
  /**
   * A page in its own signed-out browser context.
   *
   * Flows that cross roles use this for the second actor, so the admin session in `page`
   * stays alive alongside it. Closed automatically after the test.
   */
  secondSession: Page;
  /**
   * The shared chrome (top bar, side menu, toasts, result grid) bound to any page.
   *
   * For a screen with a page object, use the page object - it carries the same bundle.
   * This is for the pages that have none: a second session, or a route asserted to be
   * refused, where a spec would otherwise have to name an `.oxd-*` class itself.
   */
  chromeFor: (page: Page) => AppChrome;
}

export const sessionTest = base.extend<SessionFixtures>({
  secondSession: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  // Depends on no other fixture, but Playwright still requires the destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  chromeFor: async ({}, use) => {
    await use((page: Page) => new AppChrome(page));
  },
});
