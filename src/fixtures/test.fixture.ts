import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MyInfoPage } from '../pages/my-info.page';
import { DirectoryPage } from '../pages/directory.page';
import { EmployeeListPage } from '../pages/pim/employee-list.page';
import { AddEmployeePage } from '../pages/pim/add-employee.page';
import { PersonalDetailsPage } from '../pages/pim/personal-details.page';
import { SystemUsersPage } from '../pages/admin/system-users.page';
import { AddUserPage } from '../pages/admin/add-user.page';
import { EmployeeApi } from '../api/pim.api';
import { AppChrome } from '../core/app.chrome';
import { env } from '../config/env';
import { buildEssAccount } from '../data/account.factory';
import type { Credentials } from '../data/credentials';
import { hireEmployee, type HiredEmployee } from '../tasks/employee.tasks';
import { grantEssAccess, signInAs } from '../tasks/account.tasks';

/**
 * Page objects handed to tests as fixtures, so specs never construct them by hand.
 *
 * Authenticated projects arrive with a stored session (see global.setup.ts); the
 * `guest` project starts signed out and drives LoginPage itself.
 */
export interface PageObjects {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  myInfoPage: MyInfoPage;
  employeeListPage: EmployeeListPage;
  addEmployeePage: AddEmployeePage;
  personalDetailsPage: PersonalDetailsPage;
  /** Read-only PIM REST client on the browser's own session. */
  employeeApi: EmployeeApi;
  systemUsersPage: SystemUsersPage;
  addUserPage: AddUserPage;
  directoryPage: DirectoryPage;
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

export const test = base.extend<PageObjects, AccessControlFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  myInfoPage: async ({ page }, use) => {
    await use(new MyInfoPage(page));
  },
  employeeListPage: async ({ page }, use) => {
    await use(new EmployeeListPage(page));
  },
  addEmployeePage: async ({ page }, use) => {
    await use(new AddEmployeePage(page));
  },
  personalDetailsPage: async ({ page }, use) => {
    await use(new PersonalDetailsPage(page));
  },
  employeeApi: async ({ page }, use) => {
    await use(new EmployeeApi(page.request));
  },
  systemUsersPage: async ({ page }, use) => {
    await use(new SystemUsersPage(page));
  },
  addUserPage: async ({ page }, use) => {
    await use(new AddUserPage(page));
  },
  directoryPage: async ({ page }, use) => {
    await use(new DirectoryPage(page));
  },
  // Depends on no other fixture, but Playwright still requires the destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  chromeFor: async ({}, use) => {
    await use((page: Page) => new AppChrome(page));
  },
  secondSession: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

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

export { expect } from '@playwright/test';
