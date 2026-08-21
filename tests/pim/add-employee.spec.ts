import { test, expect } from '../../src/fixtures/test.fixture';
import { buildEmployee } from '../../src/data/employee.factory';

/**
 * These tests write to the shared public demo instance. They create records and never
 * delete them - see the README's "Shared demo data" note.
 */
test.describe('PIM - Add Employee', { tag: ['@pim', '@write'] }, () => {
  test.beforeEach(async ({ addEmployeePage }) => {
    await addEmployeePage.open();
  });

  test('prefills a generated employee id', async ({ addEmployeePage }) => {
    const generated = await addEmployeePage.generatedEmployeeId();

    expect(generated).not.toBe('');
    expect(generated).toMatch(/^\d+$/);
  });

  test('requires first and last name', async ({ addEmployeePage }) => {
    // The Employee Id is replaced with a generated one before submitting: the app's
    // prefilled id periodically collides with a record another user of the shared demo
    // created, which adds a third "Employee Id already exists" message to the count below.
    await addEmployeePage.employeeIdInput.fill(buildEmployee().employeeId);
    await addEmployeePage.submitEmpty();

    // Web-first rather than a snapshot of the list: the app renders each field's message
    // independently, so reading them once the first has appeared undercounts the set.
    await expect(addEmployeePage.validationErrors).toHaveCount(2);
    await expect(addEmployeePage.errorFor(addEmployeePage.firstNameInput)).toHaveText('Required');
    await expect(addEmployeePage.errorFor(addEmployeePage.lastNameInput)).toHaveText('Required');
  });

  test('creates an employee and shows it in the employee list', async ({
    addEmployeePage,
    employeeListPage,
    personalDetailsPage,
    page,
  }) => {
    const employee = buildEmployee();

    await addEmployeePage.createEmployee(employee);

    // Landing on Personal Details is the app's own confirmation of the save.
    await expect(page).toHaveURL(/viewPersonalDetails/);
    await expect(personalDetailsPage.firstNameInput).toHaveValue(employee.firstName);
    await expect(personalDetailsPage.lastNameInput).toHaveValue(employee.lastName);

    await employeeListPage.open();
    const rows = await employeeListPage.searchByEmployeeId(employee.employeeId);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].id).toBe(employee.employeeId);
    expect(rows[0].lastName).toBe(employee.lastName);
  });

  test('creates an employee without a middle name', async ({
    addEmployeePage,
    personalDetailsPage,
    page,
  }) => {
    const employee = buildEmployee({ middleName: '' });

    await addEmployeePage.createEmployee(employee);

    await expect(page).toHaveURL(/viewPersonalDetails/);
    await expect(personalDetailsPage.middleNameInput).toHaveValue('');
  });

  test('rejects a duplicate employee id', async ({ addEmployeePage, page }) => {
    const first = buildEmployee();
    await addEmployeePage.createEmployee(first);

    await addEmployeePage.open();
    const duplicate = buildEmployee({ employeeId: first.employeeId });
    await addEmployeePage.fillForm(duplicate);
    await addEmployeePage.save();

    await expect(addEmployeePage.validationErrors).toHaveText(['Employee Id already exists']);
    await expect(page).toHaveURL(/pim\/addEmployee/);
  });
});
