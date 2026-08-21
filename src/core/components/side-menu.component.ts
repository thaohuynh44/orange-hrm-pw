import { Locator, Page, expect } from '@playwright/test';

export const MODULES = [
  'Admin',
  'PIM',
  'Leave',
  'Time',
  'Recruitment',
  'My Info',
  'Performance',
  'Dashboard',
  'Directory',
  'Maintenance',
  'Claim',
  'Buzz',
] as const;

export type ModuleName = (typeof MODULES)[number];

/** The left-hand module navigation, present on every authenticated page. */
export class SideMenuComponent {
  readonly root: Locator;
  readonly items: Locator;
  readonly searchInput: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('aside.oxd-sidepanel');
    this.items = this.root.locator('a.oxd-main-menu-item');
    this.searchInput = this.root.locator('input[placeholder="Search"]');
  }

  item(module: ModuleName): Locator {
    return this.items.filter({ hasText: module }).first();
  }

  async goTo(module: ModuleName): Promise<void> {
    await this.item(module).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async moduleNames(): Promise<string[]> {
    return (await this.items.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  }

  async expectVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  /** Filters the menu with the sidebar search box. */
  async filter(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }
}
