import { Locator, expect } from '@playwright/test';
import { BasePage } from '../core/base.page';
import { env, routes } from '../config/env';

export class LoginPage extends BasePage {
  protected readonly path = routes.login;

  readonly usernameInput: Locator = this.page.locator('input[name="username"]');
  readonly passwordInput: Locator = this.page.locator('input[name="password"]');
  readonly loginButton: Locator = this.page.locator('button[type="submit"]');
  readonly heading: Locator = this.page.locator('h5', { hasText: 'Login' });
  readonly alert: Locator = this.page.locator('.oxd-alert-content-text');
  readonly forgotPasswordLink: Locator = this.page.locator('.orangehrm-login-forgot');
  readonly branding: Locator = this.page.locator('.orangehrm-login-branding img');

  /** Per-field "Required" validation messages. */
  fieldError(field: 'Username' | 'Password'): Locator {
    return this.page
      .locator('.oxd-input-group')
      .filter({ has: this.page.locator(`label:text-is("${field}")`) })
      .locator('.oxd-input-field-error-message');
  }

  override async expectLoaded(): Promise<void> {
    // The public demo cold-starts slowly, so the first paint gets a navigation-grade
    // budget rather than the default assertion timeout.
    await expect(this.heading).toBeVisible({ timeout: env.timeouts.navigation });
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }

  /** The login form is on screen - i.e. this session is signed out. */
  async expectFormVisible(): Promise<void> {
    await expect(this.usernameInput).toBeVisible();
  }

  /**
   * The login form is not rendered at all - i.e. a stored session was honoured and the
   * app never bounced us back here. Asserted as a count so it fails fast rather than
   * waiting out a visibility timeout on an element that should not exist.
   */
  async expectFormAbsent(): Promise<void> {
    await expect(this.usernameInput).toHaveCount(0);
  }

  /** Fills the form and submits, without asserting the outcome. */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /** Logs in and waits for the dashboard - use when the login must succeed. */
  async loginSuccessfully(username: string, password: string): Promise<void> {
    await this.login(username, password);
    await this.page.waitForURL(`**${routes.dashboard}`);
  }

  async submitEmpty(): Promise<void> {
    await this.loginButton.click();
  }

  async expectInvalidCredentials(): Promise<void> {
    await expect(this.alert).toBeVisible();
    await expect(this.alert).toHaveText('Invalid credentials');
  }

  async alertText(): Promise<string> {
    return (await this.alert.innerText()).trim();
  }
}
