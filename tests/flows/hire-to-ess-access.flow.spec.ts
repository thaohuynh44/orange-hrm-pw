import { test, expect } from '../../src/fixtures/test.fixture';
import { findEmployeeById, hireEmployee } from '../../src/tasks/employee.tasks';
import { findAccountByUsername, grantEssAccess, signInAs } from '../../src/tasks/account.tasks';
import { buildEssAccount } from '../../src/data/account.factory';
import { routes } from '../../src/config/env';

/**
 * End-to-end journey: a new hire becomes a working ESS user.
 *
 * Unlike the feature specs, this test asserts the *seams* between modules - that PIM's new
 * record is selectable in Admin, that the account Admin creates can actually sign in, and
 * that the session it produces is scoped to that employee. Field-level validation stays in
 * the feature specs; re-asserting it here would only make the journey slower and noisier.
 *
 * One journey = one test. Steps are `test.step()` blocks rather than separate tests, so the
 * chain shares state honestly and a failure points at the step that broke.
 */
test.describe('Journey - new hire to ESS access', { tag: ['@flow', '@write'] }, () => {
  test('an admin hires an employee, grants them ESS access, and they sign in', async ({
    addEmployeePage,
    employeeListPage,
    addUserPage,
    systemUsersPage,
    secondSession,
    chromeFor,
  }) => {
    // Six UI steps across three modules and two sessions - well past the default budget.
    test.slow();

    const account = buildEssAccount();

    // No middle name: the account is keyed on the record, and it keeps the employee's
    // rendered name identical in the autocomplete and in the user menu.
    const employee = await test.step('Admin hires a new employee in PIM', async () =>
      hireEmployee(addEmployeePage, { middleName: '' }));

    await test.step('the new hire is findable in the employee list', async () => {
      await findEmployeeById(employeeListPage, employee.employeeId);
    });

    await test.step('Admin grants the employee an ESS account', async () => {
      await grantEssAccess(addUserPage, employee.fullName, account);
    });

    await test.step('the account is listed as an enabled ESS user', async () => {
      await findAccountByUsername(systemUsersPage, account, { role: 'ESS', status: 'Enabled' });
    });

    const employeeDashboard =
      await test.step('the employee signs in with their own credentials', async () =>
        signInAs(secondSession, account));

    await test.step('the session belongs to the employee, not the admin', async () => {
      await expect(employeeDashboard.topBar.userName).toContainText(employee.firstName);
      await expect(employeeDashboard.topBar.userName).toContainText(employee.lastName);

      // My Info resolves to the very record created in step 1.
      await secondSession.goto(routes.myInfo);
      await expect(secondSession).toHaveURL(
        new RegExp(`viewPersonalDetails/empNumber/${employee.empNumber}`),
      );
      await expect(secondSession.locator('input[name="firstName"]')).toHaveValue(
        employee.firstName,
      );
    });

    await test.step('the ESS session cannot reach admin functionality', async () => {
      const modules = await employeeDashboard.sideMenu.moduleNames();
      expect(modules).not.toContain('Admin');
      expect(modules).not.toContain('PIM');

      // Reaching the URL directly is refused rather than rendered.
      await secondSession.goto(routes.systemUsers);
      await expect(secondSession.getByText('Credential Required')).toBeVisible();
      await chromeFor(secondSession).grid.expectNoRows();
    });
  });
});
