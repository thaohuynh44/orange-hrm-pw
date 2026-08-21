import { Locator, expect } from '@playwright/test';
import { BasePage } from '../../core/base.page';
import { routes } from '../../config/env';
import { AutocompleteComponent } from '../../core/components/autocomplete.component';
import { SelectComponent } from '../../core/components/select.component';
import { ResultsSummaryComponent } from '../../core/components/results-summary.component';
import { GridComponent } from '../../core/components/grid.component';
import { readRowCells } from '../../core/table';

export interface SystemUserRow {
  username: string;
  userRole: string;
  employeeName: string;
  status: string;
}

/** Admin > User Management > Users. */
export class SystemUsersPage extends BasePage {
  protected readonly path = routes.systemUsers;

  /** Checkbox + Username + User Role + Employee Name + Status + Actions. */
  private static readonly CELLS_PER_ROW = 6;

  private static readonly API = '/api/v2/admin/users';

  readonly grid = new GridComponent(this.page);

  /** The grid itself, and its data rows - both owned by `GridComponent`. */
  get table(): Locator {
    return this.grid.root;
  }

  get rows(): Locator {
    return this.grid.rows;
  }
  readonly results = new ResultsSummaryComponent(this.page);
  readonly searchButton: Locator = this.page.locator('button[type="submit"]', {
    hasText: 'Search',
  });
  readonly resetButton: Locator = this.page.locator('button', { hasText: 'Reset' });
  readonly usernameInput: Locator = this.page
    .locator('.oxd-input-group')
    .filter({ has: this.page.locator('label:text-is("Username")') })
    .locator('input');

  get userRole(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'User Role');
  }

  get status(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Status');
  }

  get employeeName(): AutocompleteComponent {
    return AutocompleteComponent.byLabel(this.page, 'Employee Name');
  }

  override async expectLoaded(): Promise<void> {
    await this.topBar.expectHeader('Admin');
    await expect(this.table).toBeVisible();
    await expect(this.rows.first()).toBeVisible();
  }

  async search(): Promise<void> {
    await this.withApiResponse(SystemUsersPage.API, () => this.searchButton.click());
    await this.results.waitForSettled();
  }

  async reset(): Promise<void> {
    await this.withApiResponse(SystemUsersPage.API, () => this.resetButton.click());
    await this.results.waitForSettled();
  }

  async recordCount(): Promise<number> {
    return this.results.count();
  }

  async expectNoResults(): Promise<void> {
    await expect(this.rows).toHaveCount(0);
    await this.results.expectEmpty();
  }

  async rowAt(index: number): Promise<SystemUserRow> {
    const cells = await readRowCells(this.rows.nth(index), SystemUsersPage.CELLS_PER_ROW);
    const [, username, userRole, employeeName, status] = cells;
    return { username, userRole, employeeName, status };
  }

  async allRows(): Promise<SystemUserRow[]> {
    const total = await this.rows.count();
    const rows: SystemUserRow[] = [];
    for (let i = 0; i < total; i += 1) rows.push(await this.rowAt(i));
    return rows;
  }

  async searchByUsername(username: string): Promise<SystemUserRow[]> {
    await this.usernameInput.fill(username);
    await this.search();
    return this.allRows();
  }
}
