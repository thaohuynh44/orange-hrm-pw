import { Locator, expect } from '@playwright/test';
import { BasePage } from '../../core/base.page';
import { env, routes } from '../../config/env';
import type { UserStatus } from '../admin/add-user.page';

export interface NewEmployee {
  firstName: string;
  middleName?: string;
  lastName: string;
  employeeId?: string;
}

/**
 * The inline account this screen can create alongside the employee record.
 *
 * There is no User Role control here - accounts created this way are always ESS.
 */
export interface InlineLogin {
  username: string;
  password: string;
  status?: UserStatus;
}

/** PIM > Add Employee. */
export class AddEmployeePage extends BasePage {
  protected readonly path = routes.addEmployee;

  readonly firstNameInput: Locator = this.page.locator('input[name="firstName"]');
  readonly middleNameInput: Locator = this.page.locator('input[name="middleName"]');
  readonly lastNameInput: Locator = this.page.locator('input[name="lastName"]');
  readonly saveButton: Locator = this.page.locator('button[type="submit"]');
  readonly cancelButton: Locator = this.page.locator('button', { hasText: 'Cancel' });
  readonly createLoginToggle: Locator = this.page.locator('.oxd-switch-input');
  readonly validationErrors: Locator = this.page.locator('.oxd-input-field-error-message');

  /** The form's own photo preview. The bare alt-text selector also matches the top-bar avatar. */
  readonly photoPreview: Locator = this.page.locator('img.employee-image');
  readonly photoInput: Locator = this.page.locator('input[type="file"]');

  /** Live password-strength chip, rendered above the field as the password is typed. */
  readonly passwordStrengthChip: Locator = this.page.locator('.orangehrm-password-chip');

  /** Employee Id is prefilled by the app and has no `name` attribute - reach it by label. */
  readonly employeeIdInput: Locator = this.fieldByLabel('Employee Id');

  /** None of the login fields carry a `name` attribute either. */
  get usernameInput(): Locator {
    return this.fieldByLabel('Username');
  }

  get passwordInput(): Locator {
    return this.fieldByLabel('Password');
  }

  get confirmPasswordInput(): Locator {
    return this.fieldByLabel('Confirm Password');
  }

  private fieldByLabel(label: string): Locator {
    return this.page
      .locator('.oxd-input-group')
      .filter({ has: this.page.locator(`label:text-is("${label}")`) })
      .locator('input')
      .first();
  }

  /**
   * The validation message belonging to one field, rather than the whole form's list.
   *
   * Addressed from the input rather than from a label: First/Middle/Last Name share a
   * single "Employee Full Name" label and have none of their own, but each still sits in
   * its own `.oxd-input-group` next to its own error span.
   */
  errorFor(field: Locator): Locator {
    return field
      .locator('xpath=ancestor::div[contains(@class,"oxd-input-group")][1]')
      .locator('.oxd-input-field-error-message')
      .first();
  }

  /** Status is a radio group here, unlike Admin > Add User where it is a select. */
  statusOption(status: UserStatus): Locator {
    return this.page.locator('.oxd-radio-wrapper').filter({ hasText: status });
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();
    await expect(this.firstNameInput).toBeVisible();
  }

  /**
   * Reveals the Username / Status / Password / Confirm Password fields.
   *
   * The click has to land on the `.oxd-switch-input` span: the underlying checkbox is
   * covered by it, so clicking the input itself times out.
   */
  async toggleCreateLoginDetails(): Promise<void> {
    await this.createLoginToggle.click();
    await expect(this.usernameInput).toBeVisible();
  }

  async selectStatus(status: UserStatus): Promise<void> {
    await this.statusOption(status).click();
  }

  async fillForm(employee: NewEmployee): Promise<void> {
    await this.firstNameInput.fill(employee.firstName);
    if (employee.middleName) await this.middleNameInput.fill(employee.middleName);
    await this.lastNameInput.fill(employee.lastName);
    if (employee.employeeId) await this.employeeIdInput.fill(employee.employeeId);
  }

  /** Fills the inline account fields; the toggle must already be on. */
  async fillLoginDetails(login: InlineLogin): Promise<void> {
    await this.usernameInput.fill(login.username);
    await this.passwordInput.fill(login.password);
    await this.confirmPasswordInput.fill(login.password);
    if (login.status) await this.selectStatus(login.status);
  }

  /** The app generates an id on load; capture it when the test needs to assert on it. */
  async generatedEmployeeId(): Promise<string> {
    return this.employeeIdInput.inputValue();
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.page.waitForURL(`**${routes.employeeList}`);
  }

  /** Creates the employee and waits for the resulting Personal Details screen. */
  async createEmployee(employee: NewEmployee, login?: InlineLogin): Promise<void> {
    await this.fillForm(employee);
    if (login) {
      await this.toggleCreateLoginDetails();
      await this.fillLoginDetails(login);
    }
    await this.save();
    await this.page.waitForURL(/viewPersonalDetails/, { timeout: env.timeouts.navigation });
  }

  async submitEmpty(): Promise<void> {
    await this.save();
  }

  async validationMessages(): Promise<string[]> {
    await expect(this.validationErrors.first()).toBeVisible();
    return (await this.validationErrors.allInnerTexts()).map((t) => t.trim());
  }
}
