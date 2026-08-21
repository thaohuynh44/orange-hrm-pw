import { Locator, Page, expect } from '@playwright/test';
import { env } from '../../config/env';

/**
 * The "(143) Records Found" line above every OXD result grid.
 *
 * Three states have to be handled: plural ("(143) Records Found"), singular
 * ("(1) Record Found") and empty - where the count line is replaced entirely by
 * a "No Records Found" message.
 */
export class ResultsSummaryComponent {
  readonly summary: Locator;
  readonly noRecords: Locator;

  constructor(page: Page) {
    this.summary = page
      .locator('span.oxd-text--span')
      .filter({ hasText: /\(\d+\)\s+Record/ })
      .first();
    // Scoped to the grid's own span - the same text also appears in a toast.
    this.noRecords = page
      .locator('span.oxd-text--span')
      .filter({ hasText: 'No Records Found' })
      .first();
  }

  /** Waits until the grid has committed to a result: either a count or the empty state. */
  async waitForSettled(): Promise<void> {
    await expect(this.summary.or(this.noRecords).first()).toBeVisible({
      timeout: env.timeouts.settle,
    });
  }

  /** Number of matching records; 0 when the grid reports no records. */
  async count(): Promise<number> {
    await this.waitForSettled();
    if (await this.noRecords.isVisible().catch(() => false)) return 0;

    const text = await this.summary.innerText();
    const match = text.match(/\((\d+)\)/);
    if (!match) throw new Error(`Could not parse a record count from "${text}".`);
    return Number(match[1]);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.noRecords).toBeVisible();
  }

  async expectCount(expected: number): Promise<void> {
    await expect.poll(() => this.count(), { message: 'record count' }).toBe(expected);
  }
}
