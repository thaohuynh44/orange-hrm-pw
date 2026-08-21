import { Locator, expect } from '@playwright/test';
import { BasePage } from '../../core/base.page';
import { env, routes } from '../../config/env';
import { AutocompleteComponent } from '../../core/components/autocomplete.component';
import { SelectComponent } from '../../core/components/select.component';

export type UserRole = 'Admin' | 'ESS';
export type UserStatus = 'Enabled' | 'Disabled';

export interface NewSystemUser {
  employeeFullName: string;
  username: string;
  password: string;
  role?: UserRole;
  status?: UserStatus;
}

/**
 * Admin > User Management > Users > Add.
 *
 * Neither password field carries a `name` attribute, so both are addressed by their
 * input group's label.
 */
export class AddUserPage extends BasePage {
  protected readonly path = routes.addUser;

  readonly saveButton: Locator = this.page.locator('button[type="submit"]');
  readonly validationErrors: Locator = this.page.locator('.oxd-input-field-error-message');

  get userRole(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'User Role');
  }

  get status(): SelectComponent {
    return SelectComponent.byLabel(this.page, 'Status');
  }

  get employeeName(): AutocompleteComponent {
    return AutocompleteComponent.byLabel(this.page, 'Employee Name');
  }

  private fieldByLabel(label: string): Locator {
    return this.page
      .locator('.oxd-input-group')
      .filter({ has: this.page.locator(`label:text-is("${label}")`) })
      .locator('input')
      .first();
  }

  get usernameInput(): Locator {
    return this.fieldByLabel('Username');
  }

  get passwordInput(): Locator {
    return this.fieldByLabel('Password');
  }

  get confirmPasswordInput(): Locator {
    return this.fieldByLabel('Confirm Password');
  }

  override async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Add User' })).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
  }

  async fillForm(user: NewSystemUser): Promise<void> {
    await this.userRole.selectOption(user.role ?? 'ESS');
    // The widget matches a name fragment and renders "First [Middle] Last", so it is
    // queried with the first name and then the exact record is picked from the results.
    const [firstName] = user.employeeFullName.split(' ');
    await this.employeeName.pickExact(firstName, user.employeeFullName);
    await this.status.selectOption(user.status ?? 'Enabled');
    await this.usernameInput.fill(user.username);
    await this.passwordInput.fill(user.password);
    await this.confirmPasswordInput.fill(user.password);
  }

  /** Saves and waits for the redirect back to the user list, which is the app's confirmation. */
  async createUser(user: NewSystemUser): Promise<void> {
    await this.fillForm(user);
    await this.saveButton.click();
    await this.page.waitForURL(`**${routes.systemUsers}`, {
      timeout: env.timeouts.navigation,
    });
  }
}
