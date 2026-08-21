import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MyInfoPage } from '../pages/my-info.page';
import { DirectoryPage } from '../pages/directory.page';
import { EmployeeListPage } from '../pages/pim/employee-list.page';
import { AddEmployeePage } from '../pages/pim/add-employee.page';
import { PersonalDetailsPage } from '../pages/pim/personal-details.page';
import { SystemUsersPage } from '../pages/admin/system-users.page';
import { AddUserPage } from '../pages/admin/add-user.page';

/**
 * One fixture per screen, so specs never construct a page object by hand.
 *
 * Authenticated projects arrive with a stored session (see global.setup.ts); the
 * `guest` project starts signed out and drives LoginPage itself.
 *
 * Every fixture here is a page object bound to the test's own `page`. Anything that is
 * not a screen lives elsewhere: REST clients in `api.fixture.ts`, extra browser
 * sessions and bare-page chrome in `session.fixture.ts`.
 */
export interface PageFixtures {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  myInfoPage: MyInfoPage;
  employeeListPage: EmployeeListPage;
  addEmployeePage: AddEmployeePage;
  personalDetailsPage: PersonalDetailsPage;
  systemUsersPage: SystemUsersPage;
  addUserPage: AddUserPage;
  directoryPage: DirectoryPage;
}

export const pagesTest = base.extend<PageFixtures>({
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
  systemUsersPage: async ({ page }, use) => {
    await use(new SystemUsersPage(page));
  },
  addUserPage: async ({ page }, use) => {
    await use(new AddUserPage(page));
  },
  directoryPage: async ({ page }, use) => {
    await use(new DirectoryPage(page));
  },
});
