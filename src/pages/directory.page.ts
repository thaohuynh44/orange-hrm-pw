import { Locator, expect } from '@playwright/test';
import { BasePage } from '../core/base.page';
import { routes } from '../config/env';
import { AutocompleteComponent } from '../core/components/autocomplete.component';
import { SelectComponent } from '../core/components/select.component';
import { ResultsSummaryComponent } from '../core/components/results-summary.component';

/**
 * Directory - the read-only employee finder.
 *
 * It reuses the same OXD widgets as the PIM grids (autocomplete + results summary),
 * but renders its results as cards rather than table rows.
 */
export class DirectoryPage extends BasePage {
  protected readonly path = routes.directory;

  private static readonly API = '/api/v2/directory/employees';

  readonly results = new ResultsSummaryComponent(this.page);
  readonly cards: Locator = this.page.locator('.orangehrm-directory-card');
  readonly cardNames: Locator = this.page.locator('.orangehrm-directory-card-header');
  readonly searchButton: Locator = this.page.locator('button[type="submit"]', {
    hasText: 'Search',
  });
  readonly resetButton: Locator = this.page.locator('button', { hasText: 'Reset' });

  get employeeName(): AutocompleteComponent {
    return AutocompleteComponent.byLabel(this.page, 'Employee Name');
  }

  get jobTitle(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Job Title');
  }

  get location(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Location');
  }

  override async expectLoaded(): Promise<void> {
    await this.topBar.expectHeader('Directory');
    await expect(this.searchButton).toBeVisible();
  }

  async search(): Promise<void> {
    await this.withApiResponse(DirectoryPage.API, () => this.searchButton.click());
    await this.results.waitForSettled();
  }

  async recordCount(): Promise<number> {
    return this.results.count();
  }

  /** Names as the directory cards render them, i.e. "First Last". */
  async listedNames(): Promise<string[]> {
    return (await this.cardNames.allInnerTexts()).map((name) => name.trim());
  }
}
