import { Locator, Page, expect } from '@playwright/test';

/**
 * The OXD result grid (`.oxd-table`) shared by every list screen - PIM's Employee List,
 * Admin's Users, and so on.
 *
 * Rows are `.oxd-table-card`, not `<tr>`, which is why the row reader in `core/table.ts`
 * counts cells by role rather than trusting the markup. Owning both locators here keeps
 * the class names in one place: page objects expose their own typed row readers on top.
 */
export class GridComponent {
  readonly root: Locator;
  readonly rows: Locator;
  readonly headers: Locator;

  constructor(page: Page) {
    this.root = page.locator('.oxd-table');
    this.rows = page.locator('.oxd-table-card');
    this.headers = page.locator('.oxd-table-th');
  }

  /** Column headings as rendered, in table order. */
  async columnNames(): Promise<string[]> {
    return (await this.headers.allInnerTexts()).map((heading) => heading.trim());
  }

  async rowCount(): Promise<number> {
    return this.rows.count();
  }

  /** No data rows rendered - a refused screen, or a filter that matched nothing. */
  async expectNoRows(): Promise<void> {
    await expect(this.rows).toHaveCount(0);
  }
}
