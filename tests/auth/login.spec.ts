import { test, expect } from '../../src/fixtures/test.fixture';
import { adminUser, invalidCredentials } from '../../src/data/credentials';
import { routes } from '../../src/config/env';

/** Runs in the `guest` project - no stored session. */
test.describe('Auth - Login', { tag: ['@auth', '@smoke'] }, () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.open();
  });

  test('renders the login form', async ({ loginPage }) => {
    await expect(loginPage.heading).toHaveText('Sign In');
    await expect(loginPage.loginButton).toHaveText(/Login/);
    await expect(loginPage.branding).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  test('valid credentials land on the dashboard', async ({ loginPage, dashboardPage, page }) => {
    await loginPage.loginSuccessfully(adminUser.username, adminUser.password);

    await expect(page).toHaveURL(new RegExp('dashboard/index'));
    await dashboardPage.expectLoaded();
    await expect(dashboardPage.topBar.userName).toBeVisible();
  });

  for (const credentials of invalidCredentials) {
    test(`rejects ${credentials.title}`, async ({ loginPage, page }) => {
      await loginPage.login(credentials.username, credentials.password);

      await loginPage.expectInvalidCredentials();
      await expect(page).toHaveURL(new RegExp('auth/login'));
    });
  }

  test('flags both fields as required when the form is empty', async ({ loginPage }) => {
    await loginPage.submitEmpty();

    await expect(loginPage.fieldError('Username')).toHaveText('Required');
    await expect(loginPage.fieldError('Password')).toHaveText('Required');
  });

  test('flags the password when only the username is given', async ({ loginPage }) => {
    await loginPage.usernameInput.fill(adminUser.username);
    await loginPage.submitEmpty();

    await expect(loginPage.fieldError('Password')).toHaveText('Required');
    await expect(loginPage.fieldError('Username')).toHaveCount(0);
  });

  test('masks the password input', async ({ loginPage }) => {
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
  });

  test('forgot-password link opens the reset request page', async ({ loginPage, page }) => {
    await loginPage.forgotPasswordLink.click();

    await expect(page).toHaveURL(/requestPasswordResetCode/);
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
  });

  test('does not leak credentials into the URL', async ({ loginPage, page }) => {
    await loginPage.loginSuccessfully(adminUser.username, adminUser.password);

    expect(page.url()).not.toContain(adminUser.password);
    expect(page.url()).toContain(routes.dashboard);
  });
});
