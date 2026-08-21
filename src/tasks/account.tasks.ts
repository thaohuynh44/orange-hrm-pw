import { Page, expect } from '@playwright/test';
import type { AddUserPage } from '../pages/admin/add-user.page';
import type { SystemUsersPage } from '../pages/admin/system-users.page';
import type { Credentials } from '../data/credentials';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

/** Business action: give an existing employee an ESS login. */
export async function grantEssAccess(
  addUserPage: AddUserPage,
  employeeFullName: string,
  credentials: Credentials,
): Promise<void> {
  await addUserPage.open();
  await addUserPage.createUser({
    employeeFullName,
    username: credentials.username,
    password: credentials.password,
    role: 'ESS',
    status: 'Enabled',
  });
}

/** Business action: confirm an account exists with the expected role and status. */
export async function findAccountByUsername(
  systemUsersPage: SystemUsersPage,
  credentials: Credentials,
  expected: { role: string; status: string },
): Promise<void> {
  await systemUsersPage.open();
  const rows = await systemUsersPage.searchByUsername(credentials.username);

  expect(rows, `account ${credentials.username} should exist`).toHaveLength(1);
  expect(rows[0].userRole).toBe(expected.role);
  expect(rows[0].status).toBe(expected.status);
}

/**
 * Business action: sign in on a *separate* browser session.
 *
 * Flows that cross roles use a second context rather than logging the admin out, so both
 * sessions stay alive and independent.
 */
export async function signInAs(page: Page, credentials: Credentials): Promise<DashboardPage> {
  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.loginSuccessfully(credentials.username, credentials.password);

  const dashboardPage = new DashboardPage(page);
  await dashboardPage.expectLoaded();
  return dashboardPage;
}
