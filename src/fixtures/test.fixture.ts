import { mergeTests } from '@playwright/test';
import { pagesTest } from './pages.fixture';
import { apiTest } from './api.fixture';
import { sessionTest } from './session.fixture';
import { chromeTest } from './chrome.fixture';
import { accessControlTest } from './access-control.fixture';

/**
 * The `test` every spec imports - assembled from one module per kind of fixture rather
 * than one list of everything, so what a fixture *is* is visible from where it lives:
 *
 *  - `pages.fixture.ts`          a page object per screen, on the test's own `page`
 *  - `api.fixture.ts`            read-only REST clients that verify, never drive
 *  - `session.fixture.ts`        extra browser sessions, each owning its own context
 *  - `chrome.fixture.ts`         the shared chrome, bound to a page that has no page object
 *  - `access-control.fixture.ts` worker-scoped ESS provisioning (writes to the demo)
 *
 * Specs import `test` and `expect` from here and never from `@playwright/test`, so a new
 * fixture reaches every spec by being declared in one of those modules.
 */
export const test = mergeTests(pagesTest, apiTest, sessionTest, chromeTest, accessControlTest);

export { expect } from '@playwright/test';

export type { PageFixtures } from './pages.fixture';
export type { ApiFixtures } from './api.fixture';
export type { SessionFixtures } from './session.fixture';
export type { ChromeFixtures } from './chrome.fixture';
export type { AccessControlFixtures, EssUser } from './access-control.fixture';
