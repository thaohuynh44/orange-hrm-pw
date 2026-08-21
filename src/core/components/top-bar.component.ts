import { Locator, Page, expect } from '@playwright/test';
import { routes } from '../../config/env';

/** Header bar: module breadcrumb, in-module tabs and the user dropdown. */
export class TopBarComponent {
  readonly breadcrumb: Locator;
  readonly userDropdown: Locator;
  readonly userName: Locator;
  readonly tabs: Locator;
  /**
   * The "Upgrade" promo in the header banner. Rendered for Admin sessions only, so
   * specs assert its presence per role rather than assuming it is always there.
   */
  readonly upgradeButton: Locator;

  constructor(private readonly page: Page) {
    this.breadcrumb = page.locator('.oxd-topbar-header-breadcrumb');
    this.userDropdown = page.locator('.oxd-userdropdown-tab');
    this.userName = page.locator('.oxd-userdropdown-name');
    this.tabs = page.locator('.oxd-topbar-body-nav-tab-item');
    this.upgradeButton = page.getByRole('button', { name: 'Upgrade' });
  }

  async expectHeader(title: string | RegExp): Promise<void> {
    await expect(this.breadcrumb).toContainText(title);
  }

  async openUserMenu(): Promise<void> {
    await this.userDropdown.click();
    await expect(this.page.locator('.oxd-userdropdown-link').first()).toBeVisible();
  }

  async userMenuItems(): Promise<string[]> {
    await this.openUserMenu();
    return (await this.page.locator('.oxd-userdropdown-link').allInnerTexts()).map((t) => t.trim());
  }

  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.page.locator('.oxd-userdropdown-link', { hasText: 'Logout' }).click();
    await this.page.waitForURL(`**${routes.login}`);
  }

  async openTab(name: string): Promise<void> {
    await this.tabs.filter({ hasText: name }).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }
}
