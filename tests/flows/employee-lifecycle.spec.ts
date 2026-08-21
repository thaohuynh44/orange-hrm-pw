import { test, expect } from '../../src/fixtures/test.fixture';
import { buildEmployee } from '../../src/data/employee.factory';
import { env } from '../../src/config/env';
import {
  amendPersonalDetails,
  deleteEmployee,
  hireEmployee,
  type HiredEmployee,
} from '../../src/tasks/employee.tasks';

/**
 * The full PIM record lifecycle in one journey: hire an employee, amend their personal
 * details, then delete them again.
 *
 * Every stage is driven through the UI and then confirmed against `/api/v2/pim/...` on the
 * same session, so a green run means the screen and the record behind it agree - a UI that
 * reports success while the API kept the old values is the exact failure this catches.
 *
 * Unlike the other @write suites this one hands its record back - PIM delete is the one
 * write the demo lets a test undo - but it is still tagged @write because it creates a
 * real record part-way through, and a failed run can leave that record behind.
 */
test.describe('Journey - employee lifecycle', { tag: ['@flow', '@pim', '@write'] }, () => {
  test('an admin hires, amends and then deletes an employee', async ({
    addEmployeePage,
    personalDetailsPage,
    employeeListPage,
    employeeApi,
    page,
  }) => {
    test.slow();

    const amended = buildEmployee();
    const otherId = `OID-${amended.employeeId}`;
    let hired: HiredEmployee;

    await test.step('hire the employee', async () => {
      // The POST body cannot be read once the app navigates to Personal Details, so the
      // status is captured here and the record itself is verified by GET below.
      const createResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v2/pim/employees') &&
          response.request().method() === 'POST',
        // The default action timeout is too tight for the shared demo's slower saves.
        { timeout: env.timeouts.navigation },
      );
      hired = await hireEmployee(addEmployeePage);

      expect((await createResponse).status()).toBe(200);
      expect(hired.empNumber).toMatch(/^\d+$/);
      await expect(page).toHaveURL(new RegExp(`viewPersonalDetails/empNumber/${hired.empNumber}`));
    });

    await test.step('the API serves the record the UI just created', async () => {
      const { status, data } = await employeeApi.getEmployee(hired.empNumber);

      expect(status).toBe(200);
      expect(data).toMatchObject({
        empNumber: Number(hired.empNumber),
        firstName: hired.firstName,
        middleName: hired.middleName,
        lastName: hired.lastName,
        employeeId: hired.employeeId,
        terminationId: null,
      });

      // Same filter the grid sends: proves the record is findable by employee id, and that
      // the query parameter narrows rather than being ignored.
      const search = await employeeApi.findByEmployeeId(hired.employeeId);
      expect(search.total).toBe(1);
      expect(search.records[0]).toMatchObject({ empNumber: Number(hired.empNumber) });
    });

    await test.step('the new record is listed in PIM', async () => {
      await employeeListPage.open();
      const rows = await employeeListPage.searchByEmployeeId(hired.employeeId);

      expect(rows).toHaveLength(1);
      expect(rows[0].lastName).toBe(hired.lastName);
    });

    await test.step('amend the personal details', async () => {
      const saveResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/employees/${hired.empNumber}/personal-details`) &&
          response.request().method() === 'PUT',
        { timeout: env.timeouts.navigation },
      );
      await amendPersonalDetails(personalDetailsPage, hired.empNumber, {
        lastName: amended.lastName,
        otherId,
      });

      const saved = await saveResponse;
      expect(saved.status()).toBe(200);
      // The PUT echoes the stored record, so the response is the first proof the write
      // landed rather than the form having been silently reset.
      expect((await saved.json()).data).toMatchObject({
        lastName: amended.lastName,
        otherId,
      });
      await personalDetailsPage.toast.expectSuccess('Successfully Updated');
    });

    await test.step('the API reflects the amendment', async () => {
      const { status, data } = await employeeApi.getPersonalDetails(hired.empNumber);

      expect(status).toBe(200);
      expect(data).toMatchObject({
        empNumber: Number(hired.empNumber),
        firstName: hired.firstName,
        lastName: amended.lastName,
        employeeId: hired.employeeId,
        otherId,
      });
    });

    await test.step('the amendment survives a reload', async () => {
      await personalDetailsPage.openFor(hired.empNumber);
      const details = await personalDetailsPage.currentDetails();

      expect(details.firstName).toBe(hired.firstName);
      expect(details.lastName).toBe(amended.lastName);
      expect(details.otherId).toBe(otherId);
    });

    await test.step('the amendment reaches the employee list', async () => {
      await employeeListPage.open();
      const rows = await employeeListPage.searchByEmployeeId(hired.employeeId);

      expect(rows).toHaveLength(1);
      expect(rows[0].lastName).toBe(amended.lastName);
    });

    await test.step('delete the employee', async () => {
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v2/pim/employees') &&
          response.request().method() === 'DELETE',
        { timeout: env.timeouts.navigation },
      );
      await deleteEmployee(employeeListPage, hired.employeeId);

      const deleted = await deleteResponse;
      expect(deleted.status()).toBe(200);
      // Proves the grid deleted *this* record: rows re-render in place, so a stale row
      // would send somebody else's empNumber here.
      expect(JSON.parse(deleted.request().postData() ?? '{}')).toEqual({
        ids: [Number(hired.empNumber)],
      });
      expect((await deleted.json()).data).toEqual([hired.empNumber]);
      await employeeListPage.toast.expectSuccess('Successfully Deleted');
    });

    await test.step('the API stops serving the record', async () => {
      // A deleted empNumber is rejected as an invalid parameter rather than 404.
      const { status } = await employeeApi.getEmployee(hired.empNumber);
      expect(status).toBe(422);

      const search = await employeeApi.findByEmployeeId(hired.employeeId);
      expect(search.status).toBe(200);
      expect(search.total).toBe(0);
      expect(search.records).toEqual([]);
    });

    await test.step('the record is gone from the UI', async () => {
      await employeeListPage.open();
      const rows = await employeeListPage.searchByEmployeeId(hired.employeeId);

      expect(rows).toHaveLength(0);
      await employeeListPage.expectNoResults();
    });
  });
});
