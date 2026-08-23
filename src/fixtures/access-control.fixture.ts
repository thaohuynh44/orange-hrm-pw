import { test as base, type Page } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { MyInfoPage } from '../pages/my-info.page';
import { AddEmployeePage } from '../pages/pim/add-employee.page';
import { AddUserPage } from '../pages/admin/add-user.page';
import { env } from '../config/env';
import { buildEssAccount } from '../data/account.factory';
import type { Credentials } from '../data/credentials';
import { hireEmployee, type HiredEmployee } from '../tasks/employee.tasks';
import { grantEssAccess, signInAs } from '../tasks/account.tasks';

/** The one ESS account a run provisions, plus the employee record behind it. */
export interface EssUser {
  credentials: Credentials;
  employee: HiredEmployee;
}

/**
 * Worker-scoped fixtures for role-based access tests.
 *
 * These are the expensive ones: they *write* to the shared demo. Worker scope means the
 * account is created once per worker rather than once per test, and the ESS suites pin
 * themselves to a single worker (`mode: 'serial'`) so a whole run provisions exactly one
 * account. Nothing here runs unless a test actually asks for it.
 */
export interface AccessControlFixtures {
  essUser: EssUser;
  /** A page signed in as `essUser`, in its own context. Reused across the worker's tests. */
  essPage: Page;
  essDashboardPage: DashboardPage;
  essMyInfoPage: MyInfoPage;
}

// `object` is the empty test-fixture slot: everything here is worker-scoped, and spelling it
// `Record<string, never>` instead collapses each fixture's value type to `never`.
export const accessControlTest = base.extend<object, AccessControlFixtures>({
  essUser: [
    async ({ browser }, use) => {
      // Provisioning is an admin job, so it runs in its own admin-session context and
      // that context is closed again before the ESS tests start - the ESS suites must
      // never have an authenticated admin page lying around to lean on.
      const context = await browser.newContext({ storageState: env.storageStatePath });
      const page = await context.newPage();
      const credentials = buildEssAccount();

      // No middle name: keeps the rendered name identical in the Add User autocomplete
      // and in the ESS session's user menu.
      const employee = await hireEmployee(new AddEmployeePage(page), { middleName: '' });
      await grantEssAccess(new AddUserPage(page), employee.fullName, credentials);
      await context.close();

      await use({ credentials, employee });
      // Deliberately no teardown: the demo grants no way to delete a user, which is why
      // these tests are @write and excluded from `npm run test:readonly`.
    },
    { scope: 'worker' },
  ],

  essPage: [
    async ({ browser, essUser }, use) => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      await signInAs(page, essUser.credentials);
      await use(page);
      await context.close();
    },
    { scope: 'worker' },
  ],

  essDashboardPage: [
    async ({ essPage }, use) => {
      await use(new DashboardPage(essPage));
    },
    { scope: 'worker' },
  ],

  essMyInfoPage: [
    async ({ essPage }, use) => {
      await use(new MyInfoPage(essPage));
    },
    { scope: 'worker' },
  ],
});
