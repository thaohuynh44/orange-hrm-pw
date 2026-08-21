import { Locator, expect } from '@playwright/test';
import { BasePage } from '../core/base.page';
import { env, routes } from '../config/env';
import { SelectComponent } from '../core/components/select.component';

/**
 * My Info > Personal Details.
 *
 * `/pim/viewMyDetails` redirects to `/pim/viewPersonalDetails/empNumber/<id>`, and the
 * form fields are populated by a follow-up XHR - so `expectLoaded` waits for real data,
 * not just for the inputs to exist.
 */
export class MyInfoPage extends BasePage {
  protected readonly path = routes.myInfo;

  readonly firstNameInput: Locator = this.page.locator('input[name="firstName"]');
  readonly middleNameInput: Locator = this.page.locator('input[name="middleName"]');
  readonly lastNameInput: Locator = this.page.locator('input[name="lastName"]');
  readonly tabs: Locator = this.page.locator('.orangehrm-tabs a');
  readonly saveButtons: Locator = this.page.locator('button[type="submit"]');

  get nationality(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Nationality');
  }

  get maritalStatus(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Marital Status');
  }

  /** Text input addressed by its visible label (Employee Id, Other Id, Driver's License...). */
  fieldByLabel(label: string): Locator {
    return this.page
      .locator('.oxd-input-group')
      .filter({ has: this.page.locator(`label:text-is("${label}")`) })
      .locator('input')
      .first();
  }

  override async expectLoaded(): Promise<void> {
    await this.page.waitForURL(/viewPersonalDetails/);
    await expect(this.page.getByRole('heading', { name: 'Personal Details' })).toBeVisible();
    // The name inputs exist before the record arrives; wait for the value itself.
    await expect(this.firstNameInput).not.toHaveValue('', { timeout: env.timeouts.settle });
  }

  async tabNames(): Promise<string[]> {
    await expect(this.tabs.first()).toBeVisible();
    return (await this.tabs.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  }

  async openTab(name: string): Promise<void> {
    await this.tabs.filter({ hasText: name }).first().click();
    await this.waitForSpinner();
  }

  async fullName(): Promise<{ first: string; middle: string; last: string }> {
    return {
      first: await this.firstNameInput.inputValue(),
      middle: await this.middleNameInput.inputValue(),
      last: await this.lastNameInput.inputValue(),
    };
  }

  /**
   * Saves the Personal Details block (the first Save button on the page) and waits for the
   * resulting toast. Judging that toast is the test's job, not the page object's.
   */
  async savePersonalDetails(): Promise<void> {
    await this.saveButtons.first().click();
    await expect(this.toast.root).toBeVisible();
  }
}
