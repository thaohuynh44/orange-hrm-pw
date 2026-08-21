import { Locator, Page, expect } from '@playwright/test';
import { env } from '../../config/env';

/**
 * OrangeHRM's `.oxd-autocomplete-*` widget (Employee Name, Supervisor Name, ...).
 *
 * The dropdown renders a transient "Searching...." row before the real results land,
 * so every helper here waits that placeholder out - otherwise we click it and select nothing.
 */
export class AutocompleteComponent {
  private static readonly SEARCHING = /Searching/i;

  private readonly input: Locator;
  private readonly options: Locator;

  constructor(page: Page, group: Locator) {
    this.input = group.locator('.oxd-autocomplete-text-input input');
    this.options = page.locator('.oxd-autocomplete-option');
  }

  static byLabel(page: Page, label: string, scope?: Locator): AutocompleteComponent {
    const root = scope ?? page.locator('body');
    const group = root
      .locator('.oxd-input-group')
      .filter({ has: page.locator(`label:text-is("${label}")`) })
      .first();
    return new AutocompleteComponent(page, group);
  }

  /** Types `query` and waits until real suggestions (not the spinner row) are rendered. */
  async search(query: string): Promise<string[]> {
    await this.input.fill(query);
    await expect
      .poll(
        async () =>
          (
            await this.options
              .first()
              .innerText()
              .catch(() => '')
          ).trim(),
        {
          message: `autocomplete suggestions for "${query}" never settled`,
          timeout: env.timeouts.settle,
        },
      )
      .not.toMatch(AutocompleteComponent.SEARCHING);
    return (await this.options.allInnerTexts()).map((v) => v.trim());
  }

  /** Types `query`, then picks the first real suggestion; returns the chosen text. */
  async searchAndPickFirst(query: string): Promise<string> {
    const results = await this.search(query);
    const first = this.options.first();
    const chosen = (await first.innerText()).trim();
    await first.click();
    await expect(this.input).not.toHaveValue('');
    return results[0] ?? chosen;
  }

  async pickExact(query: string, option: string): Promise<void> {
    await this.search(query);
    await this.options.filter({ hasText: option }).first().click();
  }

  async fill(value: string): Promise<void> {
    await this.input.fill(value);
  }

  async value(): Promise<string> {
    return this.input.inputValue();
  }

  /** True when the widget reports "Invalid" - i.e. free text that matched no record. */
  async hasInvalidError(): Promise<boolean> {
    return this.input
      .locator('xpath=ancestor::div[contains(@class,"oxd-input-group")]')
      .getByText('Invalid', { exact: true })
      .isVisible();
  }
}
