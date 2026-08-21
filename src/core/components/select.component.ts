import { Locator, Page, expect } from '@playwright/test';

/**
 * OrangeHRM's `.oxd-select-*` widget - a div-based dropdown, not a native <select>,
 * so it needs click-to-open plus an option click.
 */
export class SelectComponent {
  private readonly trigger: Locator;

  constructor(
    private readonly page: Page,
    group: Locator,
  ) {
    this.trigger = group.locator('.oxd-select-text');
  }

  /** Locates the widget by the visible label of its input group. */
  static byLabel(page: Page, label: string, scope?: Locator): SelectComponent {
    const root = scope ?? page.locator('body');
    const group = root
      .locator('.oxd-input-group')
      .filter({ has: page.locator(`label:text-is("${label}")`) })
      .first();
    return new SelectComponent(page, group);
  }

  async open(): Promise<void> {
    await this.trigger.click();
    await this.page.locator('.oxd-select-option').first().waitFor({ state: 'visible' });
  }

  async selectOption(option: string): Promise<void> {
    await this.open();
    await this.page.locator('.oxd-select-option').filter({ hasText: option }).first().click();
    await expect(this.trigger).toContainText(option);
  }

  async options(): Promise<string[]> {
    await this.open();
    const values = await this.page.locator('.oxd-select-option').allInnerTexts();
    await this.page.keyboard.press('Escape');
    return values.map((v) => v.trim());
  }

  async selectedValue(): Promise<string> {
    return (await this.trigger.innerText()).trim();
  }
}
