import { test, expect } from '../../src/fixtures/test.fixture';
import { adminUser } from '../../src/data/credentials';
import { routes } from '../../src/config/env';

test.describe('Auth - Session', { tag: ['@auth', '@smoke'] }, () => {
  test('redirects an unauthenticated user away from a protected page', async ({
    page,
    loginPage,
  }) => {
    await page.goto(routes.employeeList);

    await expect(page).toHaveURL(/auth\/login/);
    await loginPage.expectFormVisible();
  });

  test('logout returns to the login page and invalidates the session', async ({
    loginPage,
    dashboardPage,
    page,
  }) => {
    await loginPage.open();
    await loginPage.loginSuccessfully(adminUser.username, adminUser.password);
    await dashboardPage.expectLoaded();

    await dashboardPage.topBar.logout();
    await expect(page).toHaveURL(/auth\/login/);

    // Going back must not restore an authenticated view.
    await page.goto(routes.dashboard);
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('user menu exposes the expected actions', async ({ loginPage, dashboardPage }) => {
    await loginPage.open();
    await loginPage.loginSuccessfully(adminUser.username, adminUser.password);

    const items = await dashboardPage.topBar.userMenuItems();
    expect(items).toEqual(['About', 'Support', 'Change Password', 'Logout']);
  });

  test('the session survives a page reload', async ({ loginPage, dashboardPage, page }) => {
    await loginPage.open();
    await loginPage.loginSuccessfully(adminUser.username, adminUser.password);

    await page.reload();
    await dashboardPage.expectLoaded();
    await expect(page).toHaveURL(/dashboard\/index/);
  });
});
