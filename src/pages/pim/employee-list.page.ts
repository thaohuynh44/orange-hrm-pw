import { Locator, expect } from '@playwright/test';
import { BasePage } from '../../core/base.page';
import { routes } from '../../config/env';
import { AutocompleteComponent } from '../../core/components/autocomplete.component';
import { SelectComponent } from '../../core/components/select.component';
import { ResultsSummaryComponent } from '../../core/components/results-summary.component';
import { ConfirmDialogComponent } from '../../core/components/confirm-dialog.component';
import { GridComponent } from '../../core/components/grid.component';
import { readRowCells } from '../../core/table';

export interface EmployeeRow {
  id: string;
  firstAndMiddleName: string;
  lastName: string;
  jobTitle: string;
  employmentStatus: string;
  subUnit: string;
  supervisor: string;
}

/** PIM > Employee List: search filters plus the results table. */
export class EmployeeListPage extends BasePage {
  protected readonly path = routes.employeeList;

  /** Checkbox + Id + Name + Last Name + Job Title + Status + Sub Unit + Supervisor + Actions. */
  private static readonly CELLS_PER_ROW = 9;

  readonly grid = new GridComponent(this.page);

  /** The grid itself, and its data rows - both owned by `GridComponent`. */
  get table(): Locator {
    return this.grid.root;
  }

  get rows(): Locator {
    return this.grid.rows;
  }
  readonly results = new ResultsSummaryComponent(this.page);
  readonly confirmDialog = new ConfirmDialogComponent(this.page);
  readonly searchButton: Locator = this.page.locator('button[type="submit"]', {
    hasText: 'Search',
  });
  readonly resetButton: Locator = this.page.locator('button', { hasText: 'Reset' });
  readonly addButton: Locator = this.page.locator('button', { hasText: 'Add' }).first();
  readonly employeeIdInput: Locator = this.page
    .locator('.oxd-input-group')
    .filter({ has: this.page.locator('label:text-is("Employee Id")') })
    .locator('input');

  get employeeName(): AutocompleteComponent {
    return AutocompleteComponent.byLabel(this.page, 'Employee Name');
  }

  get supervisorName(): AutocompleteComponent {
    return AutocompleteComponent.byLabel(this.page, 'Supervisor Name');
  }

  get employmentStatus(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Employment Status');
  }

  get jobTitle(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Job Title');
  }

  get subUnit(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Sub Unit');
  }

  override async expectLoaded(): Promise<void> {
    await this.topBar.expectHeader('PIM');
    await expect(this.table).toBeVisible();
    await expect(this.rows.first()).toBeVisible();
  }

  /** Employee grid endpoint - awaited so results are read only once they have landed. */
  private static readonly API = '/api/v2/pim/employees';

  async search(): Promise<void> {
    await this.withApiResponse(EmployeeListPage.API, () => this.searchButton.click());
    await this.results.waitForSettled();
  }

  async reset(): Promise<void> {
    await this.withApiResponse(EmployeeListPage.API, () => this.resetButton.click());
    await this.results.waitForSettled();
  }

  async goToAddEmployee(): Promise<void> {
    await this.addButton.click();
    await this.page.waitForURL(`**${routes.addEmployee}`);
  }

  /** Matching records, or 0 when the grid reports "No Records Found". */
  async recordCount(): Promise<number> {
    return this.results.count();
  }

  async expectNoResults(): Promise<void> {
    await expect(this.rows).toHaveCount(0);
    await this.results.expectEmpty();
  }

  async rowCount(): Promise<number> {
    return this.grid.rowCount();
  }

  /** The grid's column headings, in table order. */
  async columnNames(): Promise<string[]> {
    return this.grid.columnNames();
  }

  /** Reads one result row into a typed object (cell order matches the table header). */
  async rowAt(index: number): Promise<EmployeeRow> {
    const cells = await readRowCells(this.rows.nth(index), EmployeeListPage.CELLS_PER_ROW);
    const [, id, firstAndMiddleName, lastName, jobTitle, employmentStatus, subUnit, supervisor] =
      cells;
    return {
      id,
      firstAndMiddleName,
      lastName,
      jobTitle,
      employmentStatus,
      subUnit,
      supervisor,
    };
  }

  async allRows(): Promise<EmployeeRow[]> {
    const total = await this.rowCount();
    const rows: EmployeeRow[] = [];
    for (let i = 0; i < total; i += 1) rows.push(await this.rowAt(i));
    return rows;
  }

  /** Filters by employee id and returns the matching rows. */
  async searchByEmployeeId(id: string): Promise<EmployeeRow[]> {
    await this.employeeIdInput.fill(id);
    await this.search();
    return this.allRows();
  }

  /** The row's trash action. Rows also carry a pencil action, hence the icon filter. */
  deleteButtonFor(row: Locator): Locator {
    return row.locator('button:has(i.bi-trash)');
  }

  /**
   * Deletes the single employee holding `employeeId`.
   *
   * The grid re-renders in place, so the filter result is proven to be exactly the
   * intended record *before* the trash icon is touched - clicking a stale row here would
   * delete somebody else's data on a shared instance.
   */
  async deleteByEmployeeId(employeeId: string): Promise<void> {
    const rows = await this.searchByEmployeeId(employeeId);
    expect(rows, `exactly one employee should hold id ${employeeId} before deleting`).toHaveLength(
      1,
    );
    expect(rows[0].id, 'the filtered row must be the record under test').toBe(employeeId);

    await this.deleteButtonFor(this.rows.first()).click();
    await this.confirmDialog.expectVisible();
    await Promise.all([
      this.apiResponse(EmployeeListPage.API, 'DELETE'),
      this.confirmDialog.confirm(),
    ]);
    // The modal closing is the commit signal here, not the refreshed grid: waiting for the
    // grid to settle outlives the "Successfully Deleted" toast the caller wants to assert.
    await expect(this.confirmDialog.root).toHaveCount(0);
  }

  rowContaining(text: string): Locator {
    return this.rows.filter({ hasText: text }).first();
  }

  async expectRowVisible(text: string): Promise<void> {
    await expect(this.rowContaining(text)).toBeVisible();
  }
}
