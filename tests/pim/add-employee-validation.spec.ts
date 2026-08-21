import { test, expect } from '../../src/fixtures/test.fixture';
import { buildEmployee, overlongName } from '../../src/data/employee.factory';
import { buildEssAccount } from '../../src/data/account.factory';
import { env } from '../../src/config/env';

/**
 * Validation on PIM > Add Employee, including the inline "Create Login Details" section.
 *
 * Nothing here saves successfully, so - unlike add-employee.spec.ts - this file creates no
 * data on the shared demo and stays in `npm run test:readonly`.
 */
test.describe('PIM - Add Employee validation', { tag: ['@pim'] }, () => {
  test.beforeEach(async ({ addEmployeePage }) => {
    await addEmployeePage.open();
  });

  test('reports five messages when submitted empty with login details enabled', async ({
    addEmployeePage,
    page,
  }) => {
    // Everything is left blank except the Employee Id, which is replaced with a generated
    // one: the app's prefilled id periodically collides with a record another user of the
    // shared demo created, adding a sixth "Employee Id already exists" message.
    await addEmployeePage.employeeIdInput.fill(buildEmployee().employeeId);
    await addEmployeePage.toggleCreateLoginDetails();

    await expect(addEmployeePage.statusOption('Enabled')).toBeVisible();
    await expect(addEmployeePage.statusOption('Disabled')).toBeVisible();
    await expect(addEmployeePage.passwordInput).toBeVisible();
    await expect(addEmployeePage.confirmPasswordInput).toBeVisible();

    await addEmployeePage.submitEmpty();

    await expect(addEmployeePage.validationErrors).toHaveCount(5);
    await expect(addEmployeePage.errorFor(addEmployeePage.firstNameInput)).toHaveText('Required');
    await expect(addEmployeePage.errorFor(addEmployeePage.lastNameInput)).toHaveText('Required');
    await expect(addEmployeePage.errorFor(addEmployeePage.usernameInput)).toHaveText('Required');
    await expect(addEmployeePage.errorFor(addEmployeePage.passwordInput)).toHaveText('Required');
    // Confirm Password reports a mismatch even when both password fields are empty -
    // it never reports "Required".
    await expect(addEmployeePage.errorFor(addEmployeePage.confirmPasswordInput)).toHaveText(
      'Passwords do not match',
    );

    await expect(page).toHaveURL(/pim\/addEmployee/);
  });

  test('rejects a first name longer than 30 characters', async ({ addEmployeePage, page }) => {
    await addEmployeePage.fillForm(buildEmployee({ firstName: overlongName() }));
    await addEmployeePage.save();

    // One error for the whole form: Last Name and the prefilled Employee Id stay clean.
    await expect(addEmployeePage.validationErrors).toHaveCount(1);
    await expect(addEmployeePage.errorFor(addEmployeePage.firstNameInput)).toHaveText(
      'Should not exceed 30 characters',
    );

    await expect(page).toHaveURL(/pim\/addEmployee/);
  });

  test('rejects an employee id longer than 10 characters', async ({ addEmployeePage, page }) => {
    // The input carries no maxlength attribute, so the limit is enforced on submit only.
    await addEmployeePage.fillForm(buildEmployee({ employeeId: 'EMP-ID-TOO-LONG-1234567890' }));
    await addEmployeePage.save();

    await expect(addEmployeePage.validationErrors).toHaveCount(1);
    await expect(addEmployeePage.errorFor(addEmployeePage.employeeIdInput)).toHaveText(
      'Should not exceed 10 characters',
    );

    await expect(page).toHaveURL(/pim\/addEmployee/);
  });

  test('flags confirm password as a mismatch, never Required, and clears it live', async ({
    addEmployeePage,
  }) => {
    const { password } = buildEssAccount();
    const confirmError = addEmployeePage.errorFor(addEmployeePage.confirmPasswordInput);

    await addEmployeePage.toggleCreateLoginDetails();
    await addEmployeePage.passwordInput.fill(password);
    await addEmployeePage.save();

    await expect(confirmError).toHaveText('Passwords do not match');

    // The field validates reactively on every keystroke - no blur, no second submit.
    await addEmployeePage.confirmPasswordInput.fill(buildEssAccount().password);
    await expect(confirmError).toHaveText('Passwords do not match');

    await addEmployeePage.confirmPasswordInput.fill(password);
    await expect(confirmError).toHaveCount(0);
  });

  test('rates password strength and flags a short password before any submit', async ({
    addEmployeePage,
  }) => {
    // Fixed passwords, not generated ones: the assertion is about the rating the app gives
    // this exact value, so the input has to be deterministic.
    const short = 'abc';
    const strongest = 'Pw!Str0ngPass9';
    const passwordError = addEmployeePage.errorFor(addEmployeePage.passwordInput);

    await addEmployeePage.toggleCreateLoginDetails();
    // The chip is absent until something is typed, rather than present and empty.
    await expect(addEmployeePage.passwordStrengthChip).toHaveCount(0);

    await addEmployeePage.passwordInput.fill(short);

    await expect(addEmployeePage.passwordStrengthChip).toHaveText('Very Weak');
    await expect(passwordError).toHaveText('Should have at least 7 characters');

    await addEmployeePage.passwordInput.fill(strongest);

    await expect(addEmployeePage.passwordStrengthChip).toHaveText('Strongest');
    await expect(passwordError).toHaveCount(0);
  });

  test('flags an already-taken username live, before Save is clicked', async ({
    addEmployeePage,
  }) => {
    const usernameError = addEmployeePage.errorFor(addEmployeePage.usernameInput);

    await addEmployeePage.toggleCreateLoginDetails();
    await addEmployeePage.usernameInput.fill(env.admin.username);

    // Backed by GET /api/v2/core/validation/unique?...&attributeName=userName, so the
    // message lands asynchronously - the retrying assertion is the wait.
    await expect(usernameError).toHaveText('Username already exists');

    await addEmployeePage.usernameInput.fill(buildEssAccount().username);
    await expect(usernameError).toHaveCount(0);
  });

  test('previews a chosen profile picture before saving, then cancels', async ({
    addEmployeePage,
    page,
  }) => {
    const topBarAvatar = addEmployeePage.topBar.userDropdown.locator('img');

    // Served from a static default-photo URL until a file is chosen.
    await expect(addEmployeePage.photoPreview).toBeVisible();
    await expect(addEmployeePage.photoPreview).not.toHaveAttribute('src', /^data:image/);

    await addEmployeePage.photoInput.setInputFiles('src/data/fixtures/avatar.png');

    // The swap is client-side and needs no save.
    await expect(addEmployeePage.photoPreview).toHaveAttribute('src', /^data:image/);
    await expect(topBarAvatar).not.toHaveAttribute('src', /^data:image/);

    await addEmployeePage.cancel();
    await expect(page).toHaveURL(/pim\/viewEmployeeList/);
  });

  test('Cancel discards the typed record without creating it', async ({
    addEmployeePage,
    employeeListPage,
    page,
  }) => {
    const abandoned = buildEmployee();

    await addEmployeePage.fillForm(abandoned);
    await addEmployeePage.cancel();
    await expect(page).toHaveURL(/pim\/viewEmployeeList/);

    // Cancel lands on the grid before Vue has mounted it; filtering any sooner is ignored.
    await employeeListPage.expectLoaded();
    const rows = await employeeListPage.searchByEmployeeId(abandoned.employeeId);

    expect(rows).toHaveLength(0);
    await employeeListPage.expectNoResults();
  });
});
