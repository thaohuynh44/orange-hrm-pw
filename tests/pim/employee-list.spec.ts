import { test, expect } from '../../src/fixtures/test.fixture';

test.describe('PIM - Employee List', { tag: '@pim' }, () => {
  test.beforeEach(async ({ employeeListPage }) => {
    await employeeListPage.open();
  });

  test('shows a populated employee table', async ({ employeeListPage }) => {
    const total = await employeeListPage.recordCount();
    expect(total).toBe(143);

    const rows = await employeeListPage.rowCount();
    expect(rows).toBeGreaterThan(0);
    // The grid pages at 50 records.
    expect(rows).toBeLessThanOrEqual(50);

    // Identity is asserted on the name, not on the Id: Employee Id is optional in the app
    // (the API returns `employeeId: null` for records saved without one, and the demo holds
    // plenty), whereas first and last name are both required by Add Employee.
    const first = await employeeListPage.rowAt(0);
    expect(first.firstAndMiddleName).not.toBe('');
    expect(first.lastName).not.toBe('');
  });

  test('table exposes the documented columns', async ({ employeeListPage }) => {
    const headers = await employeeListPage.columnNames();

    expect(headers).toEqual(
      expect.arrayContaining([
        'Id',
        'First (& Middle) Name',
        'Last Name',
        'Job Title',
        'Employment Status',
        'Sub Unit',
        'Supervisor',
        'Actions',
      ]),
    );
  });

  test('filtering by employment status narrows the result set', async ({ employeeListPage }) => {
    const before = await employeeListPage.recordCount();

    await employeeListPage.employmentStatus.selectOption('Full-Time Permanent');
    await employeeListPage.search();

    const after = await employeeListPage.recordCount();
    expect(after).toBeLessThanOrEqual(before);
    expect(after).toBeGreaterThan(0);

    for (const row of await employeeListPage.allRows()) {
      expect(row.employmentStatus).toBe('Full-Time Permanent');
    }
  });

  test('filtering by employee name returns that employee', async ({ employeeListPage }) => {
    // Pick a real suggestion rather than typing free text - the widget only filters on
    // a selected record, and the suggestion reads "First [Middle] Last".
    const picked = await employeeListPage.employeeName.searchAndPickFirst('a');
    await employeeListPage.search();

    const rows = await employeeListPage.allRows();
    expect(rows.length).toBeGreaterThan(0);

    const normalise = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
    for (const row of rows) {
      expect(normalise(picked)).toContain(normalise(row.firstAndMiddleName));
      expect(normalise(picked)).toContain(normalise(row.lastName));
    }
  });

  test('an unknown employee name yields no records', async ({ employeeListPage }) => {
    await employeeListPage.employeeName.fill('ZzzNoSuchEmployee');
    await employeeListPage.search();

    await employeeListPage.expectNoResults();
    expect(await employeeListPage.recordCount()).toBe(0);
  });

  test('reset clears the applied filters', async ({ employeeListPage }) => {
    const total = await employeeListPage.recordCount();

    await employeeListPage.employmentStatus.selectOption('Freelance');
    await employeeListPage.search();
    // Freelance may match zero records depending on the demo's current data.
    const filtered = await employeeListPage.recordCount();
    expect(filtered).toBeLessThan(total);

    await employeeListPage.reset();

    expect(await employeeListPage.employmentStatus.selectedValue()).toContain('Select');
    // Not `toBe(total)`: the demo is shared, so other people's writes move the unfiltered
    // count during the test. Reset having cleared the filter is what this asserts.
    expect(await employeeListPage.recordCount()).toBeGreaterThan(filtered);
  });

  test('Add opens the Add Employee form', async ({ employeeListPage, addEmployeePage, page }) => {
    await employeeListPage.goToAddEmployee();

    await expect(page).toHaveURL(/pim\/addEmployee/);
    await addEmployeePage.expectLoaded();
  });
});
