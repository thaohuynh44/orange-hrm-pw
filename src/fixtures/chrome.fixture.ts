import { test as base, type Page } from '@playwright/test';
import { AppChrome } from '../core/app.chrome';

/**
 * Access to the shared chrome (top bar, side menu, toasts, result grid) for a spec that
 * holds a bare `Page`.
 *
 * Its own module because it is neither a screen nor a session: it depends on no other
 * fixture and owns no lifecycle, it just binds the component bundle to whatever page it
 * is handed.
 */
export interface ChromeFixtures {
  /**
   * The shared chrome bound to any page.
   *
   * For a screen with a page object, use the page object - it carries the same bundle.
   * This is for the pages that have none: a second session, or a route asserted to be
   * refused, where a spec would otherwise have to name an `.oxd-*` class itself.
   */
  chromeFor: (page: Page) => AppChrome;
}

export const chromeTest = base.extend<ChromeFixtures>({
  // Depends on no other fixture, but Playwright still requires the destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  chromeFor: async ({}, use) => {
    await use((page: Page) => new AppChrome(page));
  },
});
