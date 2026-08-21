import { Locator, expect } from '@playwright/test';
import { BasePage } from '../../core/base.page';
import { env, routes } from '../../config/env';

export interface PersonalDetailsUpdate {
  middleName?: string;
  lastName?: string;
  otherId?: string;
  licenceNumber?: string;
}

/**
 * PIM > (employee) > Personal Details.
 *
 * The route is keyed by the app's internal empNumber, so this page is opened with
 * `openFor(empNumber)` rather than the usual fixed-path `open()`.
 */
export class PersonalDetailsPage extends BasePage {
  protected path: string = routes.myInfo;

  private static readonly API = '/personal-details';

  readonly firstNameInput: Locator = this.page.locator('input[name="firstName"]');
  readonly middleNameInput: Locator = this.page.locator('input[name="middleName"]');
  readonly lastNameInput: Locator = this.page.locator('input[name="lastName"]');
  readonly saveButton: Locator = this.page.locator('button[type="submit"]').first();

  private fieldByLabel(label: string): Locator {
    return this.page
      .locator('.oxd-input-group')
      .filter({ has: this.page.locator(`label:text-is("${label}")`) })
      .locator('input')
      .first();
  }

  get employeeIdInput(): Locator {
    return this.fieldByLabel('Employee Id');
  }

  get otherIdInput(): Locator {
    return this.fieldByLabel('Other Id');
  }

  get licenceNumberInput(): Locator {
    return this.fieldByLabel("Driver's License Number");
  }

  async openFor(empNumber: string): Promise<this> {
    this.path = routes.personalDetails(empNumber);
    return this.open();
  }

  /**
   * The inputs mount empty and are filled by a later XHR, so a value has to be on screen
   * before the form is touched - typing sooner is silently overwritten by the response,
   * and the subsequent save then writes the record's *original* values straight back.
   */
  override async expectLoaded(): Promise<void> {
    await this.topBar.expectHeader('PIM');
    await expect(this.firstNameInput).toBeVisible();
    await expect
      .poll(() => this.lastNameInput.inputValue(), {
        message: 'personal details never finished loading into the form',
        timeout: env.timeouts.settle,
      })
      .not.toBe('');
  }

  async fillForm(details: PersonalDetailsUpdate): Promise<void> {
    if (details.middleName !== undefined) await this.middleNameInput.fill(details.middleName);
    if (details.lastName !== undefined) await this.lastNameInput.fill(details.lastName);
    if (details.otherId !== undefined) await this.otherIdInput.fill(details.otherId);
    if (details.licenceNumber !== undefined) {
      await this.licenceNumberInput.fill(details.licenceNumber);
    }
  }

  /** Saves and waits for the PUT behind the form, so a later read sees committed data. */
  async save(): Promise<void> {
    await Promise.all([this.apiResponse(PersonalDetailsPage.API, 'PUT'), this.saveButton.click()]);
    await this.waitForSpinner();
  }

  async update(details: PersonalDetailsUpdate): Promise<void> {
    await this.fillForm(details);
    await this.save();
  }

  /** The values currently rendered in the form. */
  async currentDetails(): Promise<Required<PersonalDetailsUpdate> & { firstName: string }> {
    return {
      firstName: await this.firstNameInput.inputValue(),
      middleName: await this.middleNameInput.inputValue(),
      lastName: await this.lastNameInput.inputValue(),
      otherId: await this.otherIdInput.inputValue(),
      licenceNumber: await this.licenceNumberInput.inputValue(),
    };
  }
}
